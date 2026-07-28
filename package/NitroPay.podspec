require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroPay"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported, :visionos => 1.0 }
  s.source       = { :git => "https://github.com/mrousavy/nitro.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]

  # FOLLY_NO_CONFIG conflicts with RN >= 0.80's generated folly-config.h.
  react_native_below_80 = begin
    pod_root = Pod::Config.instance.installation_root.to_s
    rn_package_path = `cd "#{pod_root}" && node --print "require.resolve('react-native/package.json')"`.strip
    File.exist?(rn_package_path) && JSON.parse(File.read(rn_package_path))["version"].split(".")[1].to_i < 80
  rescue StandardError
    false
  end

  if react_native_below_80
    s.pod_target_xcconfig = {
      # C++ compiler flags, mainly for folly.
      "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES"
    }
  end

  load 'nitrogen/generated/ios/NitroPay+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
