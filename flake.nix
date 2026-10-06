{
  description = "Creator Dashboard Worker development environment";

  inputs = {
    # Same nixpkgs release the workstation pins, so the dev shell and the host
    # system share one evaluated package set and one binary cache.
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.2605";

    # Defines the OpenSpec artifact check every repository on this workstation
    # runs, so the commands and the pinned CLI live in one place.
    fleet = {
      url = "github:glockyco/omp-agent-setup";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      fleet,
    }:
    let
      # Development happens on macOS; CI evaluates the checks on Linux.
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];

      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShellNoCC {
          # Wrangler, workerd, Vite, and Playwright are package.json
          # dependencies, so pnpm-lock.yaml pins them rather than this shell.
          packages = [
            # Runs Vite, Wrangler, and the `--experimental-strip-types`
            # scripts. .github/workflows/ci.yml pins the same major
            # independently; keep both in step.
            pkgs.nodejs_24

            # pnpm switches to the exact `packageManager` version in
            # package.json; Nix supplies the matching major as the bootstrap.
            pkgs.pnpm_11
          ];
        };
      });

      formatter = forAllSystems (pkgs: pkgs.nixfmt-tree);

      checks = forAllSystems (pkgs: {
        devShell = self.devShells.${pkgs.stdenv.hostPlatform.system}.default;
        openspec = fleet.lib.openspecCheck {
          inherit pkgs;
          src = ./.;
        };
      });
    };
}
