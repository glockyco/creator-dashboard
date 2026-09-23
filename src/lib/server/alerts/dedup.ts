import type { CollectionIncident } from '$lib/server/incidents';
import { postDiscord } from './discord';

const dashboardOrigin = 'https://dashboard.glockyco.com';

export async function maybeSendFailureAlert(
  env: Env,
  incident: CollectionIncident,
  now = Date.now()
): Promise<boolean> {
  if (incident.resolvedAt !== null || incident.failureNotificationState === 'sent') return false;

  const claim = await env.DB.prepare(
    `
      UPDATE collection_incidents
      SET failure_notification_state = 'sending',
          failure_notification_attempted_at = ?
      WHERE id = ?
        AND resolved_at IS NULL
        AND failure_notification_state IN ('not_requested', 'failed')
    `
  )
    .bind(now, incident.id)
    .run();
  if (claim.meta.changes !== 1) return false;

  const issueUrl = `${dashboardOrigin}/issues/${incident.id}`;
  const status = incident.latestStatusCode === null ? '' : ` HTTP ${incident.latestStatusCode}.`;
  const error =
    incident.latestError.length > 1_400 ? `${incident.latestError.slice(0, 1_397)}...` : incident.latestError;
  try {
    await postDiscord(
      env.DISCORD_ALERTS_WEBHOOK,
      `creator-dashboard ${incident.latestTier} failure: ${incident.sourceId}.${status}\n${error}\nInvestigate: ${issueUrl}`
    );
  } catch (notificationError) {
    await env.DB.prepare(
      `
        UPDATE collection_incidents
        SET failure_notification_state = 'failed'
        WHERE id = ? AND failure_notification_state = 'sending'
      `
    )
      .bind(incident.id)
      .run()
      .catch(() => undefined);
    throw notificationError;
  }

  await env.DB.prepare(
    `
      UPDATE collection_incidents
      SET failure_notification_state = 'sent',
          failure_notified_at = ?
      WHERE id = ? AND failure_notification_state = 'sending'
    `
  )
    .bind(now, incident.id)
    .run();
  return true;
}

export async function maybeSendRecoveryAlert(
  env: Env,
  incident: CollectionIncident,
  now = Date.now()
): Promise<boolean> {
  if (
    incident.resolvedAt === null ||
    incident.failureNotificationState !== 'sent' ||
    incident.recoveryNotificationState === 'sent'
  ) {
    return false;
  }

  const claim = await env.DB.prepare(
    `
      UPDATE collection_incidents
      SET recovery_notification_state = 'sending',
          recovery_notification_attempted_at = ?
      WHERE id = ?
        AND resolved_at IS NOT NULL
        AND failure_notification_state = 'sent'
        AND recovery_notification_state IN ('pending', 'failed')
    `
  )
    .bind(now, incident.id)
    .run();
  if (claim.meta.changes !== 1) return false;

  const issueUrl = `${dashboardOrigin}/issues/${incident.id}`;
  try {
    await postDiscord(
      env.DISCORD_ALERTS_WEBHOOK,
      `creator-dashboard recovery: ${incident.sourceId}\nIncident #${incident.id} recovered.\nIssue: ${issueUrl}`
    );
  } catch (notificationError) {
    await env.DB.prepare(
      `
        UPDATE collection_incidents
        SET recovery_notification_state = 'failed'
        WHERE id = ? AND recovery_notification_state = 'sending'
      `
    )
      .bind(incident.id)
      .run()
      .catch(() => undefined);
    throw notificationError;
  }

  await env.DB.prepare(
    `
      UPDATE collection_incidents
      SET recovery_notification_state = 'sent',
          recovery_notified_at = ?
      WHERE id = ? AND recovery_notification_state = 'sending'
    `
  )
    .bind(now, incident.id)
    .run();
  return true;
}
