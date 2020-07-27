const Fs = require('fs');
const Path = require('path');
const JavascriptObfuscator = require('javascript-obfuscator');

const configFileDir = 'local/';
const configFileName = 'ccc-obfuscated-code.json';
const defaultConfig = {
  auto: false,
  files: ['/src/project.js'],
  useAbsPath: false,
  preset: 'lower',
  options: {}
};

const presetFileUrl = 'packages://ccc-obfuscated-code/preset.json';
let presets = null;

/**
 * 保存配置
 * @param {object} config 
 */
function saveConfig(config) {
  let projectPath = Editor.Project.path || Editor.projectPath;
  let configDirPath = Path.join(projectPath, configFileDir);
  if (!Fs.existsSync(configDirPath)) Fs.mkdirSync(configDirPath);
  let configFilePath = Path.join(configDirPath, configFileName);
  // 读取本地配置
  let object = {};
  if (Fs.existsSync(configFilePath)) {
    object = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
  }
  // 写入配置
  for (let key in config) object[key] = config[key];
  let string = JSON.stringify(object, null, 2);
  Fs.writeFileSync(configFilePath, string);
  Editor.log('[CC]', '配置文件路径', configFilePath);
}

/**
 * 读取配置
 */
function getConfig() {
  let projectPath = Editor.Project.path || Editor.projectPath;
  let configFilePath = Path.join(projectPath, configFileDir, configFileName);
  let config = null;
  if (Fs.existsSync(configFilePath)) {
    config = JSON.parse(Fs.readFileSync(configFilePath, 'utf8'));
  }
  if (!config) {
    config = JSON.parse(JSON.stringify(defaultConfig));
    config.options = getPreset('off');
    if (config.preset !== 'off') {
      let preset = getPreset(config.preset);
      for (let key in preset) {
        config.options[key] = preset[key];
      }
    }
  }
  return config;
}

/**
 * 读取预设参数
 * @param {string} type 预设名 
 */
function getPreset(type) {
  if (presets) return presets[type];

  let presetFilePath = Editor.url(presetFileUrl);
  if (Fs.existsSync(presetFilePath)) {
    presets = JSON.parse(Fs.readFileSync(presetFilePath, 'utf8'));
    return presets[type];
  }

  return null;
}

/**
 * 混淆
 * @param {string} path 文件路径
 * @param {ObfuscatorOptions} options 混淆参数
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
    Editor.Builder.on('before-change-files', this.onBeforeChangeFiles);
  },

  unload() {
    Editor.Builder.removeListener('build-start', this.onBuildStart);
    Editor.Builder.removeListener('before-change-files', this.onBeforeChangeFiles);
  },

  messages: {

    'open-panel'() {
      Editor.log('[CC]', '代码混淆工具/构建后自动混淆');
      Editor.Panel.open('ccc-obfuscated-code');
    },

    // TODO
    // 'open-panel-do'() {
    //   Editor.log('[CC] 代码混淆工具/主动混淆');
    //   Editor.Panel.open('ccc-obfuscated-code-do');
    // },

    'save-config'(event, config) {
      Editor.log('[CC]', '保存配置');
      saveConfig(config);
      event.reply(null, true);
    },

    'read-config'(event) {
      Editor.log('[CC]', '读取配置');
      let config = getConfig();
      event.reply(null, config);
    },

    'get-preset'(event, name) {
      Editor.log('[CC]', '读取预设', name);
      let preset = getPreset(name);
      if (preset) {
        event.reply(null, preset);
      } else {
        Editor.warn('[CC]', '预设文件已丢失');
        Editor.warn('[CC]', '预设文件下载地址 https://gitee.com/ifaswind/ccc-obfuscated-code/blob/master/preset.json');
        event.reply(null, {});
      }
    }

  },

  /**
   * 
   * @param {BuildOptions} options 
   * @param {Function} callback 
   */
  onBuildStart(options, callback) {
    const config = getConfig();
    if (config.auto) Editor.log('[CC]', '将在项目构建完成后自动混淆代码');

    callback();
  },

  /**
   * 
   * @param {BuildOptions} options 
   * @param {Function} callback 
   */
  onBeforeChangeFiles(options, callback) {
    const config = getConfig();
    if (config.auto) {
      Editor.log('[CC]', '正在混淆代码...');
      for (let i = 0; i < config.files.length; i++) {
        if (config.files[i] === '') continue;
        let path = config.useAbsPath ? config.files[i] : Path.join(options.dest, config.files[i]);
        if (Fs.existsSync(path)) {
          obfuscate(path, config.options);
          Editor.log('[CC]', '已混淆文件', path);
        } else {
          Editor.warn('[CC]', '文件不存在', path);
        }
      }
      Editor.log('[CC]', '混淆已结束');
    }

    callback();
  },

}