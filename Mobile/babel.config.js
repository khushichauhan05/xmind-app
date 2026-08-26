module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // SDK 54 rename: react-native-reanimated/plugin -> react-native-worklets/plugin.
    // The worklets plugin MUST be the last plugin in the array.
    plugins: ["react-native-worklets/plugin"],
  };
};
