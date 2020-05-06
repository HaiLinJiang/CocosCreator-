let Fs = require('fs');
let Path = require('path');
let JavascriptObfuscator = require('javascript-obfuscator');

let defaultConfig = {
  auto: false,
  files: ['/src/project.js'],
  preset: 'low',
  options: {}
};

let presetFileUrl = 'packages://ccc-obfuscated-code/preset.json';
let presets = null;

/**
 * 保存配置
 * @param {*} config 
 */
function saveConfig(config) {
  let projectPath = Editor.Project.path || Editor.projectPath;
  let projectName = Editor.Project.name || projectPath.slice(projectPath.lastIndexOf('\\') + 1);
  let configDirPath = Path.join(projectPath, '/local/');
  if (!Fs.existsSync(configDirPath)) Fs.mkdirSync(configDirPath);
  let configFilePath = Path.join(configDirPath, 'ccc-obfuscated-code.json');
  let configs = {};
  // 读取本地配置
  if (Fs.existsSync(configFilePath)) {
    configs = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
  }
  // 写入配置
  if (!configs[projectName]) configs[projectName] = {};
  for (let key in config) {
    configs[projectName][key] = config[key];
  }
  let string = JSON.stringify(configs, null, 2);
  Fs.writeFileSync(configFilePath, string);
  Editor.log('[CC] 配置文件路径', configFilePath);
}

/**
 * 读取配置
 */
function getConfig() {
  let projectPath = Editor.Project.path || Editor.projectPath;
  let projectName = Editor.Project.name || projectPath.slice(projectPath.lastIndexOf('\\') + 1);
  let configFilePath = Path.join(projectPath, '/local/ccc-obfuscated-code.json');
  let config = null;
  if (Fs.existsSync(configFilePath)) {
    config = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'))[projectName];
  }
  if (!config) {
    config = defaultConfig;
    config.options = getPreset('default');
    if (config.preset !== 'default') {
      let preset = getPreset(config.preset);
      for (let key in preset) {
        config.options[key] = preset[key];
      }
    }
  }
  return config;
};

/**
 * 读取预设参数
 */
function getPreset(name) {
  if (presets) {
    return presets[name];
  } else {
    let presetFilePath = Editor.url(presetFileUrl);
    if (Fs.existsSync(presetFilePath)) {
      presets = JSON.parse(Fs.readFileSync(presetFilePath, 'utf8'));
      return presets[name];
    } else {
      return null;
    }
  }
};

/**
 * 混淆
 * @param {*} path 文件路径
 * @param {*} options 混淆参数
 */
function obfuscate(path, options) {
  let sourceCode = Fs.readFileSync(path, 'utf8');
  let obfuscationResult = JavascriptObfuscator.obfuscate(sourceCode, options);
  let obfuscatedCode = obfuscationResult.getObfuscatedCode();
  Fs.writeFileSync(path, obfuscatedCode);
}

module.exports = {

  load() {
    Editor.Builder.on('build-start', this.onBuildStart);
    Editor.Builder.on('build-finished', this.onBuildFinished);
  },

  unload() {
    Editor.Builder.removeListener('build-start', this.onBuildStart);
    Editor.Builder.removeListener('build-finished', this.onBuildFinished);
  },

  messages: {

    'open-panel'() {
      Editor.log('[CC] 代码混淆工具/构建后自动混淆');
      Editor.Panel.open('ccc-obfuscated-code');
    },

    // TODO
    // 'open-panel'() {
    //   Editor.log('[CC] 代码混淆工具/主动混淆');
    //   Editor.Panel.open('ccc-obfuscated-code-do');
    // },

    'save-config'(event, config) {
      Editor.log('[CC] 保存配置');
      saveConfig(config);
      event.reply(null, true);
    },

    'read-config'(event) {
      Editor.log('[CC] 读取配置');
      let config = getConfig();
      event.reply(null, config);
    },

    'get-preset'(event, name) {
      Editor.log('[CC] 读取预设', name);
      let preset = getPreset(name);
      if (preset) {
        event.reply(null, preset);
      } else {
        Editor.log('[CC] 预设文件已丢失');
        Editor.log('[CC] 文件下载地址 https://gitee.com/ifaswind/ccc-obfuscated-code/blob/master/preset.json');
        event.reply(null, {});
      }
    }

  },

  async onBuildStart(options, callback) {
    let config = getConfig();
    if (config.auto) Editor.log('[CC] 将在项目构建完成后自动混淆代码');

    callback();
  },

  async onBuildFinished(options, callback) {
    let config = getConfig();
    if (config.auto) {
      Editor.log('[CC] 正在混淆代码');
      for (let i = 0; i < config.files.length; i++) {
        let path = Path.join(options.dest, config.files[i]);
        if (Fs.existsSync(path)) {
          Editor.log('[CC] 混淆文件', path);
          obfuscate(path, config.options);
        } else {
          Editor.warn('[CC] 文件不存在', path);
        }
      }
      Editor.log('[CC] 混淆已结束');
    }

    callback();
  },
}