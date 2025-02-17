This is the problematic source code line

```ts
const key = keys.find(({ keyid }) => signatures.some((s) => s.keyid === keyid));
const signature = signatures.find(({ keyid }) => keyid === key?.keyid);

if (key == null || signature == null)
  throw new Error(
    `Cannot find matching keyid: ${JSON.stringify({ signatures, keys })}`,
  );
```

Error: Cannot find matching keyid: {"signatures":[{"sig":"MEUCICK4bLF6Ywa/faC/4PIt094EbceYRe19bBHQW0rAS/dGAiEA8/ofAy07ETUbu+ca1PM4HDYqcHOjBlvgvdWvG0hy3as=","keyid":"SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U"}],"keys":[{"expires":null,"keyid":"SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA","keytype":"ecdsa-sha2-nistp256","scheme":"ecdsa-sha2-nistp256","key":"MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1Olb3zMAFFxXKHiIkQO5cJ3Yhl5i6UPp+IhuteBJbuHcA5UogKo0EWtlWwW6KSaKoTNEYL7JlCQiVnkhBktUgg=="}]}

```json
{
  "signatures": [
    {
      "sig": "MEUCICK4bLF6Ywa/faC/4PIt094EbceYRe19bBHQW0rAS/dGAiEA8/ofAy07ETUbu+ca1PM4HDYqcHOjBlvgvdWvG0hy3as=",
      "keyid": "SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U"
    }
  ],
  "keys": [
    {
      "expires": null,
      "keyid": "SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA",
      "keytype": "ecdsa-sha2-nistp256",
      "scheme": "ecdsa-sha2-nistp256",
      "key": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1Olb3zMAFFxXKHiIkQO5cJ3Yhl5i6UPp+IhuteBJbuHcA5UogKo0EWtlWwW6KSaKoTNEYL7JlCQiVnkhBktUgg=="
    }
  ]
}
```

The issue is with pnpm@10.1.0. Downgrading to pnpm@10.0.0 fixes the issue.

The issue is also with corepack@0.31.0.

v0.31.0
https://github.com/nodejs/corepack/blob/v0.31.0/config.json#L166

#v0.30.0
https://github.com/nodejs/corepack/blob/v0.30.0/config.json#L166

Solutions

1. `corepack enable && corepack prepare --activate`

Upgrading the global versions

#

When running outside of an existing project (for example when running yarn init), Corepack will by default use predefined versions roughly corresponding to the latest stable releases from each tool. Those versions can be overridden by running the corepack prepare command along with the package manager version you wish to set:

corepack prepare yarn@x.y.z --activate

Alternately, a tag or range may be used:

corepack prepare pnpm@latest --activate
corepack prepare yarn@stable --activate

Offline workflow

#

Many production environments don't have network access. Since Corepack usually downloads the package manager releases straight from their registries, it can conflict with such environments. To avoid that happening, call the corepack prepare command while you still have network access (typically at the same time you're preparing your deploy image). This will ensure that the required package managers are available even without network access.

2. `npm install -g corepack@latest` (0.31.0)
3. Upgrade to Node.js 23.7.0 or above.
4. Update env variable COREPACK_KEYS

```sh
# programmatically
curl -sS https://registry.npmjs.org/-/npm/v1/keys | jq -c '{npm: .keys}'

# In GH Actions
echo "COREPACK_INTEGRITY_KEYS=$(curl -sS https://registry.npmjs.org/-/npm/v1/keys | jq -c '{npm: .keys}')" >> $GITHUB_ENV
```

```json
{
  "npm": [
    {
      "expires": "2025-01-29T00:00:00.000Z",
      "keyid": "SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA",
      "keytype": "ecdsa-sha2-nistp256",
      "scheme": "ecdsa-sha2-nistp256",
      "key": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1Olb3zMAFFxXKHiIkQO5cJ3Yhl5i6UPp+IhuteBJbuHcA5UogKo0EWtlWwW6KSaKoTNEYL7JlCQiVnkhBktUgg=="
    },
    {
      "expires": null,
      "keyid": "SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U",
      "keytype": "ecdsa-sha2-nistp256",
      "scheme": "ecdsa-sha2-nistp256",
      "key": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEY6Ya7W++7aUPzvMTrezH6Ycx3c+HOKYCcNGybJZSCJq/fd7Qa8uuAKtdIkUQtQiEKERhAmE5lMMJhP8OkDOa2g=="
    }
  ]
}
```

4. Set `COREPACK_INTEGRITY_KEYS=0` or `COREPACK_INTEGRITY_KEYS=""` (Very insecure)
