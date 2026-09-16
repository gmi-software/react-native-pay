require "json"
require "open3"

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
  # Fail hard if React Native cannot be resolved — a silent fallback would apply
  # the wrong Folly flags and either crash modern RN or break older installs.
  pod_root = Pod::Config.instance.installation_root.to_s
  rn_package_path, _stderr, status = Open3.capture3(
    "node",
    "--print",
    "require.resolve('react-native/package.json')",
    chdir: pod_root
  )
  rn_package_path = rn_package_path.strip
  unless status.success? && !rn_package_path.empty? && File.exist?(rn_package_path)
    raise "NitroPay: unable to resolve react-native/package.json from #{pod_root}. " \
          "Install React Native before running `pod install`."
  end

  rn_version = JSON.parse(File.read(rn_package_path))["version"]
  if rn_version.nil? || rn_version.to_s.strip.empty?
    raise "NitroPay: react-native package.json is missing a version field (#{rn_package_path})."
  end

  begin
    react_native_below_80 = Gem::Version.new(rn_version) < Gem::Version.new("0.80.0")
  rescue ArgumentError
    raise "NitroPay: unable to parse React Native version #{rn_version.inspect} from #{rn_package_path}."
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
