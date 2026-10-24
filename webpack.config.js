const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const config = {
    entry: ["./index.tsx"],
    output: {
        path: path.resolve("public", "dist"),
        filename: "bundle.js"
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".css", ".scss"]
    },
    module: {
        rules: [
            {
                // The styles go into a file of their own that index.html links
                // in <head>, so the page is styled before the script arrives.
                test: /\.s[ac]ss$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader",
                    "sass-loader",
                ],
            },
            {
                test: /\.css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader"
                ],
            },
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({filename: "bundle.css"}),
    ],
};

module.exports = config;
