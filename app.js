'use strict';

const path = require('path');
const fs = require('fs-extra');
const _get = require('lodash.get');
const execSync = require('child_process').execSync;
const terser = require("terser");
const Plugin = require("./plugin").Plugin;

async function run(options) {
    console.log('> Starting');

    var plugins = [
        new Plugin(path.resolve(_getCliPath(), 'partial-common')),
        options.addmssql ? new Plugin(path.resolve(_getCliPath(), 'partial-mssql')) : null,
        new Plugin(path.resolve(_getCliPath(), options.apptype === 'koa' ? 'template-koa' : 'template-simple'))
    ];

    // build the folder completely
    for (let i = 0; i < plugins.length; i++) {
        const p = plugins[i];
        if (p) {
            _buildDestinationFolder(p.copyTask(), options.dest);
        }        
    }

    // run npm completely
    for (let i = 0; i < plugins.length; i++) {
        const p = plugins[i];
        if (p) {
            _installTemplateDeps(p.npmInstallTask())
        }        
    }

    // apply config completely
    for (let i = 0; i < plugins.length; i++) {
        const p = plugins[i];
        if (p) {
            _applyConfig(p.updateConfigTask(), path.join(options.dest, 'src', 'api', 'config.json'));
        }        
    }
}

/**
 * Gets the folder path of this cli
 */
function _getCliPath() {
    return __dirname;
}

function _isDebugEnv() {
    // cwd is the directory where the program is run.
    // Normally the developer will locate himself in the root of the project to call node commands.
    return _getCliPath() === process.cwd();
}

function _buildDestinationFolder(copyTask, destPath) {
    let entries = copyTask.getFilesToCopy();
    for (let i = 0; i < entries.length; i++) {
        let entry = entries[i];

        // convert the entry to the destination
        let destfile = path.resolve(destPath, path.relative(copyTask.config.path, entry));

        if (copyTask.shouldMinify(entry)) {
            // minify the js files except for some we want to ignore
            var minResult = _minifyJs(entry, destfile);

            if (!minResult.ok) {
                if (minResult.reason == 'uglify') {
                    console.log(`>> Error to minify ${destfile}: ` + JSON.stringify(minResult.error));
                } else if (minResult.reason == 'write') {
                    console.log(`>> Error to write ${destfile}: ` + minResult.error.message);
                }
            } else {
                console.log(`>> Copied and minified ${destfile}`);
            }
        } else {
            // simple copy of the file
            fs.copySync(entry, destfile, { overwrite: true });
            console.log(`>> Copied ${destfile}`);
        }
    }
}

function _minifyJs(inPath, outPath) {
    var inContent = fs.readFileSync(inPath, "utf8");

    var mincode = {};
    mincode[path.basename(inPath)] = inContent;
    var uglycode = terser.minify(mincode);
    if (uglycode.error) {
        return {
            ok: false,
            reason: 'uglify',
            error: uglycode.error
        };
    } else {
        try {
            // disable eslint on minified files
            var inMinContent = '/* eslint-disable */\n' + uglycode.code;
            fs.createFileSync(outPath);
            fs.writeFileSync(outPath, inMinContent);
            return {
                ok: true
            };
        } catch (ex) {
            return {
                ok: false,
                reason: 'writeFile',
                error: ex
            };
        }
    }
}

function _installTemplateDeps(npmInsTask) {
    // process package.json
    var pkg = npmInsTask.readDependencies();
    if (pkg.hasAny) {
        console.log('> Install npm dependencies (this could take some minutes). Please do not touch the console.');

        // NOTE: Why not just copy the template package.json and run a global npm install? Because by doing a fresh npm install of
        // each package (without the version), we will always get the latest version of each library.
        [
            { list: pkg.dependencies, args: '--save' },
            { list: pkg.devDependencies, args: '--save-dev' },
        ].forEach(elem => {
            for (const pkgKey in elem.list) {
                var cmd = `npm install ${elem.args} ${pkgKey}`;
                if (!_isDebugEnv()) {
                    execSync(cmd, { stdio: [0, 1, 2] });
                } else {
                    // NOTE: when debugging, do not mess with any package.json
                    console.log('>> <mock> ' + cmd);
                }
            }
        });
    }
}

function _applyConfig(configTask, configFile) {
    if (configTask.hasAny()) {
        console.log(`>> Updating config file ${configFile}`);
        configTask.applyToFile(configFile);
        console.log('>> Updated');
    }
}

module.exports = run;
