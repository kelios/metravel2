# Генератор standalone XCUITest-проекта. Живёт ВНЕ ios/: `expo prebuild`
# перегенерирует ios/ и снёс бы таргет, добавленный туда.
require 'xcodeproj'
require 'fileutils'

root = File.expand_path(__dir__)
path = File.join(root, 'MetravelDeviceUITests.xcodeproj')
FileUtils.rm_rf(path)

project = Xcodeproj::Project.new(path)
target = project.new_target(:ui_test_bundle, 'MetravelDeviceUITests', :ios, '15.1')

group = project.new_group('MetravelDeviceUITests', 'MetravelDeviceUITests')
file = group.new_file('RunScriptTests.swift')
target.add_file_references([file])

team = ENV.fetch('DEVELOPMENT_TEAM', '')
target.build_configurations.each do |config|
  config.build_settings.merge!(
    'PRODUCT_BUNDLE_IDENTIFIER' => 'by.metravel.deviceuitests',
    'DEVELOPMENT_TEAM' => team,
    'CODE_SIGN_STYLE' => 'Automatic',
    'SWIFT_VERSION' => '5.0',
    'TARGETED_DEVICE_FAMILY' => '1',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'IPHONEOS_DEPLOYMENT_TARGET' => '15.1',
    'USES_XCTRUNNER' => 'YES',
    'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES' => 'YES'
  )
end

project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_test_target(target)
scheme.save_as(path, 'MetravelDeviceUITests', true)
puts "generated #{path}"
