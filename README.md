# gh-actions-node-corepack

This is an example of a typical Github Actions `.yml` file for a Node.js project using pnpm and corepack.

```yml
name: CI

on:
  push:
    branches: ["main"]

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [23.8.0]
    steps:
      - name: Check out Git repository
        id: checkout
        uses: actions/checkout@v4

      - name: Enable Node.js corepack shims
        run: |
          npm install -g corepack
          corepack enable

      - name: Set up Node.js environment
        id: setup_node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm

      - name: Install dependencies and build
        run: |
          pnpm install
          pnpm run build
```

In general, you'll find this action works fine for most projects. However, there are some nuances involved that may be worth considering.

## Context

If you are running Github Actions on Github-hosted runners, there are a set of pre-installed software. Of particular note for [`ubuntu-latest`](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) and [`macos-latest`](https://github.com/actions/runner-images/blob/main/images/macos/macos-14-arm64-Readme.md) are:

- Node.js `20.18.2` (Ubuntu 24.04), Node.js `20.18.1` (macOS 14)
- NPM `10.8.2`
- Yarn `1.22.22`

That's why running `corepack enable` before `actions/setup-node` is possible -- you are actually running `corepack` from the pre-installed Node.js version.

## Caveats

However, that does introduce an interesting dilemma. Consider:

```yml
jobs:
  *:
    steps:
      - name: Enable Node.js corepack shims
        run: |
          npm install -g corepack
          corepack enable

      - run: |
          echo "Node.js version: $(node -v), Node.js path: $(which node)"
          echo "NPM version: $(npm -v), NPM path: $(which npm)"
          echo "Corepack version: $(corepack -v), NPM path: $(which corepack)"
          echo "PNPM version: $(pnpm -v), PNPM path: $(which pnpm)"
          echo "Current \$PATH: $PATH"

      - uses: actions/setup-node@v4

      - run: |
          echo "Node.js version: $(node -v), Node.js path: $(which node)"
          echo "NPM version: $(npm -v), NPM path: $(which npm)"
          echo "Corepack version: $(corepack -v), Corepack path: $(which corepack)"
          echo "PNPM version: $(pnpm -v), PNPM path: $(which pnpm)"
          echo "Current \$PATH: $PATH"
```

This is the output:

```
Node.js version: v20.18.2, Node.js path: /usr/local/bin/node
NPM version: 10.8.2, NPM path: /usr/local/bin/npm
Corepack version: 0.31.0, Corepack path: /usr/local/bin/corepack
PNPM version: 10.4.0, PNPM path: /usr/local/bin/pnpm
Current $PATH: /snap/bin:/home/runner/.local/bin:/opt/pipx_bin:/home/runner/.cargo/bin:/home/runner/.config/composer/vendor/bin:/usr/local/.ghcup/bin:/home/runner/.dotnet/tools:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin

> Setup Node.js environment
...

Node.js version: v23.8.0, Node.js path: /opt/hostedtoolcache/node/23.8.0/x64/bin/node
NPM version: 10.9.2, NPM path: /opt/hostedtoolcache/node/23.8.0/x64/bin/npm
Corepack version: 0.31.0, Corepack path: /opt/hostedtoolcache/node/23.8.0/x64/bin/corepack
PNPM version: 10.4.0, PNPM path: /usr/local/bin/pnpm
Current $PATH: /opt/hostedtoolcache/node/23.8.0/x64/bin:/snap/bin:/home/runner/.local/bin:/opt/pipx_bin:/home/runner/.cargo/bin:/home/runner/.config/composer/vendor/bin:/usr/local/.ghcup/bin:/home/runner/.dotnet/tools:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin

```

Notice the difference: Node.js, NPM, and Corepack now correspond to the Node.js installation from `actions/setup-node`. However, `pnpm` is still the pre-installed version (or rather, it points to the pre-installed shims installed by the pre-installed Corepack).

In general, you won't notice any issues. However, it can introduce some really subtle bugs. For example, if you ever use `corepack`, after running that command, corepack will overwrite `pnpm` shims and you'll no longer be using that pre-installed corepack.

Arguably, it also affects the intent of using a pinned Node.js version in the first place by slightly deviating the GitHub actions environment from the actual development environment.

It may be more concerning in the future if the pre-installed corepack deviates significantly from the corepack version you are actually using. Corepack currently is still in its pre-1.0.0 stage and some commands (`hydrate`, `prepare`) have been deprecated.

It does raise the question why corepack is necessary to be ran before setting up Node.js. If you try the following:

```yml
- name: Set up Node.js environment
  uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node }}
    cache: pnpm

- name: Enable Node.js corepack shims
  run: |
    npm install -g corepack
    corepack enable
```

The output is:

```
> Run actions/setup-node@v4
Attempting to download 23.8.0...
Not found in manifest. Falling back to download directly from Node
Acquiring 23.8.0 - x64 from https://nodejs.org/dist/v23.8.0/node-v23.8.0-linux-x64.tar.gz
Extracting ...
/usr/bin/tar xz --strip 1 --warning=no-unknown-keyword --overwrite -C /home/runner/work/_temp/... -f /home/runner/work/_temp/...
Adding to the cache ...
Done
> Environment details
**Error: Unable to locate executable file: pnpm. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also check the file mode to verify the file is executable.**
```

In this case, the offending command being run is `pnpm store path --silent` which is run by `@actions/exec` to get a path to cache in `@actions/setup-node`. The output should be `/home/runner/.local/share/pnpm/store/v10`.

In this case, this is fine for most installations that don't update the store path, so it is always the same. There may be some subtle bugs, either if you set up .pnpmrc afterward, set `$PNPM_HOME`, `$XDG_DATA_HOME`, or some other ways the store path can be changed (see [pnpm/npmrc#store-dir](https://pnpm.io/npmrc#store-dir)), but those are mostly niche edge cases.

However, it does mean that if you want to use the `corepack` shims with the Node.js version installed by `actions/setup-node` -- you can't. If you do, you'd have to cache the `pnpm` store path yourself.

As a thought experiment, here's a way that uses `corepack` shims with the Node.js version installed by `actions/setup-node`. Obviously, this is not recommended due to opening yourself up to security vulnerabilities.

```yml
- name: Temporarily alias `pnpm` to `corepack pnpm`
  run: |
    setup() {
      unset -f main
      local -r local_bin_dir="$HOME/.local/bin" # By default, $HOME/.local/bin is in $PATH
      local -r package_manager="$1"

      mkdir -p "$local_bin_dir"
      cat << EOF >> "$local_bin_dir/$package_manager"
    #!/bin/bash

    corepack $package_manager "\$@"
    rm "$local_bin_dir/$package_manager" # Remove alias after use

    EOF

      chmod u+x "$local_bin_dir/$package_manager" # Make alias executable for current user
    }

    setup pnpm

- name: Set up Node.js environment
  uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node }}
    cache: pnpm

- name: Enable Node.js corepack shims
  run: corepack enable
```

Unfortunately, the typical ways of using a `function`, `alias`, or a local file would not work in this case. "@actions/exec" explicitly executes tools that are only in the path, and for tools not in the path, they must be doubled quoted.

What ends up happening is that when `@actions/setup-node` attempts to exec `pnpm store path --silent`, it will end up running `corepack pnpm store path --silent` instead. What this does is that it installs `pnpm` (and caches it) and then runs the command. Afterward, it removes the alias. Then, you can enable `corepack` on the new Node.js version, in which it installs the cached `pnpm` and creates the shims for it in the correct directory.

There's actually not much in the way of benefits of this approach. Corepack will be cached by `@actions/setup-node` so you won't need to download it again. You should be guaranteed that `pnpm` and `npm` always point to the correct installations.

There are some other concerns that may be worth considering. For example, if you explicitly set a `registry-url`, `scope`, or `always-auth` in `@actions/setup-node`, it will set a `.npmrc` file at `${{ env.NPM_CONFIG_USERCONFIG }}` (`/home/runner/work/_temp/.npmrc`). The intent is to overwrite the `userconfig` key in `.npmrc` (which is otherwise by default `$HOME/.npmrc`).

In that case, afterward, I do recommend having the following step after `@actions/setup-node` to explicitly guarantee the intended npm path is used. If you don't want to use their `.npmrc`, then it may be worth considering adding this to your own `.npmrc` file.

```yml
- name: Update `.npmrc` file
  run: |
    cat << EOF >> ${{ env.NPM_CONFIG_USERCONFIG }}

    ; pnpm
    npm-path=`npm config get prefix`/bin/npm ; If you intend to use npm from `@actions/setup-node`

    npm-path=/usr/local/bin/npm ; If you intend to use the pre-installed npm
    EOF
```

## Conclusion

I really don't think there is any concrete solution or best practice to these concerns. While they are mostly insignificant, they do present valid concerns I would argue are meaningful with setting up corepack in Github Actions. The best course of action is to be aware of these concerns and make a decision based on your own needs. Ideally, `@actions/setup-node` would have a way to explicitly toggle corepack before attempting to cache package managers, but I am empathetic to the fact that current guidance on using `corepack` as of right now is very confusing.
