const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Injects the PagSeguro PlugPag Maven repository into android/build.gradle
 * with content filtering so Gradle only queries it for br.com.uol.pagseguro artifacts.
 * This prevents 502 errors when Gradle searches other packages in this repo.
 */
module.exports = function withPagSeguroMaven(config) {
  return withProjectBuildGradle(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes('pagseguromaster/plugpag')) {
      return config; // already injected
    }

    const mavenBlock = [
      `    maven {`,
      `      url 'https://github.com/pagseguromaster/plugpag/raw/master/3.x/android'`,
      `      content {`,
      `        includeGroup 'br.com.uol.pagseguro'`,
      `      }`,
      `    }`,
    ].join('\n');

    config.modResults.contents = contents.replace(
      "maven { url 'https://www.jitpack.io' }",
      `maven { url 'https://www.jitpack.io' }\n${mavenBlock}`
    );

    return config;
  });
};
