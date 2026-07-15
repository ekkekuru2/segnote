{
  description = "segnote by ekkekuru2";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShell = pkgs.mkShell {
          # numpyは高速化のために共有ライブラリを使いたいのだが、NixOSでは設計上そのままだとそれができない
          # 事前にNixOSのconfiguration.nixでnix-ldを有効化した上で、LD_LIBRARY_PATHを設定してあげる。
          LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath (
            with pkgs;
            [
              # glibc
              # glibc.dev
              # glib
              # libgcc
              stdenv.cc.cc
              zlib
            ]
          );
          buildInputs = with pkgs;[
            python311
            uv
            ffmpeg
            cacert
            nodejs_24
            pnpm
            typescript
            typescript-language-server
            prisma-engines
            prisma
            openssl
          ];
          shellHook = ''
            export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
            echo "uv version: $(uv --version)"
            echo "python version: $(python --version)"
            export PKG_CONFIG_PATH="${pkgs.openssl.dev}/lib/pkgconfig";
            export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [ pkgs.openssl ]}:$LD_LIBRARY_PATH"
            export PRISMA_SCHEMA_ENGINE_BINARY="${pkgs.prisma-engines}/bin/schema-engine"
            export PRISMA_QUERY_ENGINE_BINARY="${pkgs.prisma-engines}/bin/query-engine"
            export PRISMA_QUERY_ENGINE_LIBRARY="${pkgs.prisma-engines}/lib/libquery_engine.node"
            export PRISMA_FMT_BINARY="${pkgs.prisma-engines}/bin/prisma-fmt"
          '';
        };
      });
}
