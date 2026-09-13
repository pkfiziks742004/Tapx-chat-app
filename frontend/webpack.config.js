import configFactory from "./webpack.config.cjs";

export default function config(env, argv) {
  return configFactory(env, argv);
}

