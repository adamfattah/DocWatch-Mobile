// Merges local, gitignored values (config.local.json) over app.json so real keys never land in the public repo.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const file = path.join(__dirname, "config.local.json");
  if (!fs.existsSync(file)) return config;
  const local = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    ...config,
    ios: { ...config.ios, bundleIdentifier: local.bundleIdentifier ?? config.ios.bundleIdentifier },
    plugins: config.plugins.map((p) =>
      Array.isArray(p) && p[0] === "@react-native-google-signin/google-signin" && local.googleIosUrlScheme
        ? [p[0], { ...p[1], iosUrlScheme: local.googleIosUrlScheme }] : p),
    extra: { ...config.extra, ...local.extra, eas: { ...config.extra.eas, ...(local.extra?.eas ?? {}) } },
  };
};
