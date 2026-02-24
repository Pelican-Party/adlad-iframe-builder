# AdLad Iframe Builder

This tool is intended for portals which require you to upload a zip file, but for which you would still like to host your game on your own domain.
The main benefit of this approach is that it allows you to release updates without having to upload a new version to all gaming portals individually.

This tool generates an index.html with a full screen iframe pointing to your domain. The page comes with AdLad built-in and you can choose which plugin to include.

## Usage

To generate a zip simply run

```
npx @adlad/iframe-builder
```

The tool will ask a couple of questions, or you can provide arguments to run it in non-interactive mode:

- `--plugin`, `-p` The name of the AdLad plugin you would like to include in the index.html file. If the plugin is published under the `@adlad` namespace, the `@adlad/plugin-` part can be omitted. For instance, specifying `dummy` would use the [`@adlad/plugin-dummy`](https://www.npmjs.com/package/@adlad/plugin-dummy) package from npm. If you want to use a plugin which is published under a different namespace, you have to provide the full package name such as `@namespace/plugin-name`. Packages without a namespace are not supported, but you can also provide a tarball or github url.
- `--url`, `-u` The url where you plan on hosting your game, excluding any AdLad query string parameters. The protocol is optional and defaults to https. For example, providing `example.com/my-game/` will set the iframe src parameter to `https://example.com/?adlad=iframe-bridge`.
- `--adlad-version`, `-v` The AdLad version to use, defaults to 'latest'.
- `--query-string-key`, `-q` If you changed the `pluginSelectQueryStringKey` in the new AdLad() options, you can use this to change the query string parameter that is used for the iframe. For example, if you specify `myNewParam`, the iframe will point to `https://example.com/?myNewParam=iframe-bridge` instead.

The tool will then generate a `game.zip` file which contains the index.html. This can then be uploaded to your game portal of choice.

## Iframe Bridge Plugin

To make the game communicate with the parent page, make sure you have installed the [iframe bridge plugin](https://github.com/Pelican-Party/adlad-plugin-iframe-bridge). For more info on how to use plugins with AdLad, see [this page](https://github.com/Pelican-Party/adlad?tab=readme-ov-file#plugins).
