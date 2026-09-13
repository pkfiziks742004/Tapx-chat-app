const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const dotenv = require("dotenv");

module.exports = () => {
  const envPath = path.join(__dirname, ".env");
  const parsed = dotenv.config({ path: envPath }).parsed || {};
  const env = { ...process.env, ...parsed };

  const defineKeys = Object.keys(env).filter((k) => k.startsWith("VITE_"));
  const defines = Object.fromEntries(
    defineKeys.map((key) => [`process.env.${key}`, JSON.stringify(env[key] ?? "")])
  );

  for (const key of ["VITE_API_URL"]) {
    const defineKey = `process.env.${key}`;
    if (!(defineKey in defines)) defines[defineKey] = JSON.stringify("");
  }

  return {
    entry: path.join(__dirname, "src", "index.js"),
    output: {
      path: path.join(__dirname, "dist"),
      filename: "assets/[name].[contenthash].js",
      publicPath: "/",
      clean: true
    },
    resolve: {
      extensions: [".js", ".jsx"]
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                ["@babel/preset-env", { targets: "defaults" }],
                ["@babel/preset-react", { runtime: "automatic" }]
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader", "postcss-loader"]
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: "asset/resource",
          generator: {
            filename: "assets/[name].[contenthash][ext]"
          }
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.join(__dirname, "public", "index.html"),
        favicon: path.join(__dirname, "public", "fev.png")
      }),
      new webpack.DefinePlugin(defines)
    ],
    devServer: {
      port: 5173,
      historyApiFallback: true
    }
  };
};
