/* global module, require, __dirname */

// Единственный источник iOS-кастомизаций нативного проекта (#2742): tracked
// `ios/` — результат `expo prebuild --clean --platform ios` + `pod install`, а
// не ручные правки. Плагин стоит первым в `app.json` plugins: mods одного типа
// выполняются от последнего добавленного к первому, поэтому его Info.plist- и
// Xcode-правки применяются поверх встроенных и сторонних плагинов.

const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withFinalizedMod,
  withInfoPlist,
  withPodfile,
  withPodfileProperties,
  withXcodeProject,
} = require('expo/config-plugins');

// Имя Xcode-проекта, таргета и продукта (`metravel.app`). Expo берёт его из
// `expo.name` (`MeTravel`), а отдельного поля для имени проекта у него нет.
const PROJECT_NAME = 'metravel';
const DEVELOPMENT_REGION = 'ru';
const PURPOSE_STRING_LOCALES = ['en', 'ru', 'be', 'uk', 'pl'];
const RESOURCES_DIR = path.join(__dirname, 'ios');

// Фиксированные идентификаторы объектов pbxproj: повторная генерация даёт тот
// же проект байт в байт.
const IDS = {
  stringsBuildFile: '1416A0011416A0011416A001',
  stringsVariantGroup: '1416A0021416A0021416A002',
  stringsFileRefs: {
    en: '1416A0031416A0031416A003',
    ru: '1416A0041416A0041416A004',
    be: '1416A0051416A0051416A005',
    uk: '1416A0061416A0061416A006',
    pl: '1416A0071416A0071416A007',
  },
  privacyBuildFile: '87DF7D8972496FC5BD0BF18C',
  privacyFileRef: '6CAA2D0E401B868533801E61',
  devLauncherPhase: '52CE112DC0E2423FBF83CED5',
};

// iPhone — только портрет; iPad — все ориентации (`orientation: default` для
// него и для Android).
const IPHONE_ORIENTATIONS = [
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationPortraitUpsideDown',
];

// Ключи, которые сторонние и встроенные плагины добавляют в Info.plist, но
// которых нет в проверенном релизном контракте: dev-launcher (локальная сеть),
// Meta SDK (SKAdNetwork), expo-location (непереведённая строка точной
// геопозиции), expo-apple-authentication и базовый шаблон. Минимальную версию
// ОС Xcode выводит из deployment target.
const INFO_PLIST_KEYS_TO_DROP = [
  'CFBundleAllowMixedLocalizations',
  'LSMinimumSystemVersion',
  'NSBonjourServices',
  'NSLocalNetworkUsageDescription',
  'NSLocationTemporaryUsageDescriptionDictionary',
  'SKAdNetworkItems',
];

const PODFILE_MODULAR_HEADERS = `
  # Google Sign-In's AppCheckCore Swift pod needs module maps for these
  # Objective-C transitive dependencies when CocoaPods links static libraries.
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
`;

const PODFILE_RESOURCE_BUNDLE_SIGNING = `
    # This is necessary for Xcode 14, because it signs resource bundles by default
    # when building for devices.
    installer.target_installation_results.pod_target_installation_results
      .each do |pod_name, target_installation_result|
      target_installation_result.resource_bundle_targets.each do |resource_bundle_target|
        resource_bundle_target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        end
      end
    end
`;

function renameEntry(dir, from, to) {
  // macOS-тома нечувствительны к регистру: `existsSync('MeTravel')` истинно и
  // для `metravel`, поэтому сверяем точное имя и переименовываем через
  // временное.
  if (!fs.readdirSync(dir).includes(from)) return;
  const temporary = path.join(dir, `${to}.renaming`);
  fs.renameSync(path.join(dir, from), temporary);
  fs.renameSync(temporary, path.join(dir, to));
}

function replaceInFile(filePath, from, to) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  const next = contents.split(from).join(to);
  if (next !== contents) fs.writeFileSync(filePath, next);
}

// Имя шаблона (`modRequest.projectName`) mod-compiler вычисляет один раз до
// запуска mods, и встроенные плагины ищут по нему таргет, поэтому проект
// переименовывается в finalized-mod, когда все остальные mods уже отработали.
function renameTemplateProject(iosRoot, templateName) {
  if (templateName === PROJECT_NAME) return;
  const projectDir = `${PROJECT_NAME}.xcodeproj`;
  renameEntry(iosRoot, `${templateName}.xcodeproj`, projectDir);
  renameEntry(iosRoot, templateName, PROJECT_NAME);

  const schemesDir = path.join(iosRoot, projectDir, 'xcshareddata', 'xcschemes');
  if (fs.existsSync(schemesDir)) {
    renameEntry(schemesDir, `${templateName}.xcscheme`, `${PROJECT_NAME}.xcscheme`);
  }
  const sourcesDir = path.join(iosRoot, PROJECT_NAME);
  renameEntry(sourcesDir, `${templateName}-Bridging-Header.h`, `${PROJECT_NAME}-Bridging-Header.h`);
  renameEntry(sourcesDir, `${templateName}.entitlements`, `${PROJECT_NAME}.entitlements`);

  // Info.plist не трогаем: в нём `CFBundleDisplayName` = `expo.name`.
  for (const filePath of [
    path.join(iosRoot, projectDir, 'project.pbxproj'),
    path.join(schemesDir, `${PROJECT_NAME}.xcscheme`),
    path.join(iosRoot, 'Podfile'),
    path.join(iosRoot, 'Podfile.properties.json'),
  ]) {
    replaceInFile(filePath, templateName, PROJECT_NAME);
  }
}

function copyAppResources(iosRoot, projectName) {
  const sourcesDir = path.join(iosRoot, projectName);
  fs.copyFileSync(
    path.join(RESOURCES_DIR, 'PrivacyInfo.xcprivacy'),
    path.join(sourcesDir, 'PrivacyInfo.xcprivacy'),
  );
  for (const locale of PURPOSE_STRING_LOCALES) {
    const target = path.join(sourcesDir, `${locale}.lproj`);
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(
      path.join(RESOURCES_DIR, `${locale}.lproj`, 'InfoPlist.strings'),
      path.join(target, 'InfoPlist.strings'),
    );
  }
}

const withAppResourceFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const { platformProjectRoot, projectName } = modConfig.modRequest;
      copyAppResources(platformProjectRoot, projectName);
      return modConfig;
    },
  ]);

// Expo перекодирует иконку при генерации; App Store-иконка остаётся побайтовой
// копией исходника (`ios-release-guard` сверяет sha256 обоих файлов).
function copyAppStoreIcon(iosRoot, projectName, projectRoot, iconPath) {
  if (!iconPath) return;
  fs.copyFileSync(
    path.resolve(projectRoot, iconPath),
    path.join(
      iosRoot,
      projectName,
      'Images.xcassets',
      'AppIcon.appiconset',
      'App-Icon-1024x1024@1x.png',
    ),
  );
}

const withProjectName = (config) =>
  withFinalizedMod(config, [
    'ios',
    (modConfig) => {
      const { platformProjectRoot, projectName, projectRoot } = modConfig.modRequest;
      copyAppStoreIcon(
        platformProjectRoot,
        projectName,
        projectRoot,
        modConfig.ios?.icon || modConfig.icon,
      );
      renameTemplateProject(platformProjectRoot, projectName);
      return modConfig;
    },
  ]);

function nonCommentEntries(section) {
  return Object.entries(section || {}).filter(([id]) => !id.endsWith('_comment'));
}

function addObject(objects, section, id, value, comment) {
  objects[section] = objects[section] || {};
  objects[section][id] = value;
  objects[section][`${id}_comment`] = comment;
}

function addResource(objects, projectName, buildFileId, fileRefId, name) {
  addObject(
    objects,
    'PBXBuildFile',
    buildFileId,
    { isa: 'PBXBuildFile', fileRef: fileRefId, fileRef_comment: name },
    `${name} in Resources`,
  );
  const [, mainGroup] = nonCommentEntries(objects.PBXGroup).find(
    ([, group]) => group.name === projectName,
  );
  mainGroup.children.push({ value: fileRefId, comment: name });
  const [, resources] = nonCommentEntries(objects.PBXResourcesBuildPhase)[0];
  resources.files.push({ value: buildFileId, comment: `${name} in Resources` });
}

function linkAppResources(project, projectName) {
  const objects = project.hash.project.objects;
  if (objects.PBXBuildFile?.[IDS.privacyBuildFile]) return;

  addObject(
    objects,
    'PBXFileReference',
    IDS.privacyFileRef,
    {
      isa: 'PBXFileReference',
      includeInIndex: 1,
      name: 'PrivacyInfo.xcprivacy',
      path: `${projectName}/PrivacyInfo.xcprivacy`,
      sourceTree: '"<group>"',
    },
    'PrivacyInfo.xcprivacy',
  );
  for (const locale of PURPOSE_STRING_LOCALES) {
    addObject(
      objects,
      'PBXFileReference',
      IDS.stringsFileRefs[locale],
      {
        isa: 'PBXFileReference',
        lastKnownFileType: 'text.plist.strings',
        name: locale,
        path: `${projectName}/${locale}.lproj/InfoPlist.strings`,
        sourceTree: '"<group>"',
      },
      locale,
    );
  }
  addObject(
    objects,
    'PBXVariantGroup',
    IDS.stringsVariantGroup,
    {
      isa: 'PBXVariantGroup',
      children: PURPOSE_STRING_LOCALES.map((locale) => ({
        value: IDS.stringsFileRefs[locale],
        comment: locale,
      })),
      name: 'InfoPlist.strings',
      sourceTree: '"<group>"',
    },
    'InfoPlist.strings',
  );
  addResource(objects, projectName, IDS.stringsBuildFile, IDS.stringsVariantGroup, 'InfoPlist.strings');
  addResource(objects, projectName, IDS.privacyBuildFile, IDS.privacyFileRef, 'PrivacyInfo.xcprivacy');
}

function setLocalizationRegions(project) {
  const [, projectConfig] = nonCommentEntries(project.hash.project.objects.PBXProject)[0];
  projectConfig.developmentRegion = DEVELOPMENT_REGION;
  const regions = projectConfig.knownRegions.filter((region) => region !== 'Base');
  for (const locale of PURPOSE_STRING_LOCALES) {
    if (!regions.includes(locale)) regions.push(locale);
  }
  projectConfig.knownRegions = [...regions, 'Base'];
}

// Версия и номер сборки живут в build settings, а Info.plist ссылается на них
// переменными — так `ios-release-guard` сверяет одно значение в одном месте.
function setVersionBuildSettings(project, { version, buildNumber }) {
  for (const [, configuration] of nonCommentEntries(
    project.hash.project.objects.XCBuildConfiguration,
  )) {
    const settings = configuration.buildSettings;
    if (!settings?.INFOPLIST_FILE) continue;
    settings.MARKETING_VERSION = version;
    settings.CURRENT_PROJECT_VERSION = buildNumber;
  }
}

// expo-dev-launcher добавляет фазу со случайным id на каждый prebuild;
// фиксированный id делает повторную генерацию воспроизводимой.
function pinDevLauncherPhaseId(project) {
  const objects = project.hash.project.objects;
  const phases = objects.PBXShellScriptBuildPhase || {};
  const [currentId] = nonCommentEntries(phases).find(
    ([, phase]) => String(phase.name).includes('[Expo Dev Launcher]'),
  ) || [];
  if (!currentId || currentId === IDS.devLauncherPhase) return;

  phases[IDS.devLauncherPhase] = phases[currentId];
  phases[`${IDS.devLauncherPhase}_comment`] = phases[`${currentId}_comment`];
  delete phases[currentId];
  delete phases[`${currentId}_comment`];
  for (const [, target] of nonCommentEntries(objects.PBXNativeTarget)) {
    for (const phase of target.buildPhases || []) {
      if (phase.value === currentId) phase.value = IDS.devLauncherPhase;
    }
  }
}

const withXcodeProjectContract = (config) =>
  withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    pinDevLauncherPhaseId(project);
    linkAppResources(project, modConfig.modRequest.projectName);
    setLocalizationRegions(project);
    setVersionBuildSettings(project, {
      version: modConfig.version,
      buildNumber: modConfig.ios.buildNumber,
    });
    return modConfig;
  });

function applyInfoPlistContract(info) {
  for (const key of INFO_PLIST_KEYS_TO_DROP) delete info[key];
  info.CFBundleDevelopmentRegion = DEVELOPMENT_REGION;
  info.CFBundleShortVersionString = '$(MARKETING_VERSION)';
  info.CFBundleVersion = '$(CURRENT_PROJECT_VERSION)';
  info.RCTNewArchEnabled = true;
  info.UISupportedInterfaceOrientations = [...IPHONE_ORIENTATIONS];
  return info;
}

const withInfoPlistContract = (config) =>
  withInfoPlist(config, (modConfig) => {
    modConfig.modResults = applyInfoPlistContract(modConfig.modResults);
    return modConfig;
  });

function insertAfter(contents, anchor, block) {
  if (contents.includes(block)) return contents;
  if (!contents.includes(anchor)) {
    throw new Error(`withIosNativeProject: Podfile anchor not found: ${anchor.trim()}`);
  }
  return contents.replace(anchor, `${anchor}${block}`);
}

function applyPodfileContract(contents) {
  const withModularHeaders = insertAfter(contents, '  use_expo_modules!\n', PODFILE_MODULAR_HEADERS);
  return insertAfter(
    withModularHeaders,
    '      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n',
    PODFILE_RESOURCE_BUNDLE_SIGNING,
  );
}

const withPodfileContract = (config) =>
  withPodfile(config, (modConfig) => {
    modConfig.modResults.contents = applyPodfileContract(modConfig.modResults.contents);
    return modConfig;
  });

const withPodfilePropertiesContract = (config) =>
  withPodfileProperties(config, (modConfig) => {
    modConfig.modResults.newArchEnabled = 'true';
    return modConfig;
  });

function withIosNativeProject(config) {
  config = withAppResourceFiles(config);
  config = withXcodeProjectContract(config);
  config = withInfoPlistContract(config);
  config = withPodfileContract(config);
  config = withPodfilePropertiesContract(config);
  config = withProjectName(config);
  return config;
}

module.exports = withIosNativeProject;
module.exports.INFO_PLIST_KEYS_TO_DROP = INFO_PLIST_KEYS_TO_DROP;
module.exports.PROJECT_NAME = PROJECT_NAME;
module.exports.applyInfoPlistContract = applyInfoPlistContract;
module.exports.applyPodfileContract = applyPodfileContract;
