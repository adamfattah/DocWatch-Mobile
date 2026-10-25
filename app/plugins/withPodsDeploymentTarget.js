// Raise every Pod target's iOS deployment target to the app's minimum.
// Newer Xcode refuses old targets (e.g. 9.0/12.0) on pod resource bundles.
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const MIN = "15.1";
const MARK = "# docwatch: pods deployment target + fmt fix v2";

module.exports = (config) =>
  withDangerousMod(config, ["ios", (cfg) => {
    const file = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
    let src = fs.readFileSync(file, "utf8");
    if (!src.includes(MARK)) {
      // Inject AFTER react_native_post_install(...) so RN's own settings don't override ours.
      src = src.replace(/react_native_post_install\([\s\S]*?\n    \)\n/, (m) => m +
        `    ${MARK}\n` +
        `    installer.pods_project.targets.each do |t|\n` +
        `      t.build_configurations.each do |c|\n` +
        `        if c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN}\n` +
        `          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN}'\n` +
        `        end\n` +
        // fmt 11.0.2 + newer Apple clang: consteval errors; compile fmt as C++17.
        `        c.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17' if t.name == 'fmt'\n` +
        `      end\n    end\n`);
      fs.writeFileSync(file, src);
    }
    return cfg;
  }]);
