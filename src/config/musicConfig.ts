import type { MusicPlayerConfig } from "../types/config";

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 禁用音乐播放器方法：
	// 模板默认侧边栏和导航栏两个都显示
	// 1. 侧边栏：在sidebarConfig.ts侧边栏配置把音乐组件enable设为false禁用即可
	// 2. 导航栏：在本配置文件把showInNavbar设为false禁用即可

	// 是否在导航栏显示音乐播放器入口
	showInNavbar: true,

	// 使用方式："meting" 使用 Meting API，"local" 使用本地音乐列表
	mode: "meting",

	// 默认音量 (0-1)
	volume: 0.6,

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode: "random",

	// 是否显启用歌词
	showLyrics: true,

	// Meting API 配置
	meting: {
		// Meting API 地址
		// 默认使用官方 API，也可以使用自定义 API
		api: "https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id&r=:r",
		// 音乐平台：netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
		server: "netease",
		// 类型：song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家
		type: "playlist",
		// 歌单/专辑/单曲 ID 或搜索关键词
		id: "10135821595",
		// 认证 token（可选）
		auth: "",
		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis: [
			"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&r=:r",
			"https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
		],
	},

	// 本地音乐配置（当 mode 为 'local' 时使用）
	// 1. 支持传入歌词文件的路径
	// lrc: "/assets/music/lrc/使一颗心免于哀伤-哼唱.lrc",
	// 2. 或者直接填入歌词字符串内容
	// lrc: "[00:00.00]歌词内容...",
	local: {
		playlist: [
			{
				name: "使一颗心免于哀伤",
				artist: "知更鸟 / HOYO-MiX / Chevy",
				url: "/assets/music/使一颗心免于哀伤-哼唱.mp3",
				cover: "/assets/music/cover/109951169585655912.webp",
				lrc: "",
			},
		],
		// 在线歌单保持原有顺序、封面和歌词，只用本地文件覆盖受限音源。
		// 键为网易云歌曲 ID，方便同名歌曲也能准确匹配。
		overrides: {
			"3381729685": {
				url: "/assets/music/seasonal-vegetables/3381729685.m4a",
			},
			"32857600": {
				url: "/assets/music/seasonal-vegetables/32857600.m4a",
			},
			"2711291901": {
				url: "/assets/music/seasonal-vegetables/2711291901.m4a",
			},
			"472045267": {
				url: "/assets/music/seasonal-vegetables/472045267.m4a",
			},
			"1410455847": {
				url: "/assets/music/seasonal-vegetables/1410455847.m4a",
			},
			"2700280437": {
				url: "/assets/music/seasonal-vegetables/2700280437.m4a",
			},
			"2723920997": {
				url: "/assets/music/seasonal-vegetables/2723920997.m4a",
			},
			"572328440": {
				url: "/assets/music/seasonal-vegetables/572328440.m4a",
			},
			"1317285056": {
				url: "/assets/music/seasonal-vegetables/1317285056.m4a",
			},
		},
	},

	// 可视化器配置
	visualizer: {
		background: {
			dark: "#000000",
			light: "#000000",
		},
		camera: {
			position: {
				x: 0,
				y: 32,
				z: 52,
			},
		},
		autoRotate: true,
		autoRotateSpeed: 0.3,
		height: {
			// 静态地形起伏高度，不播放时也会有轻微波动
			idle: 0.6,
			// 超低频高度，主要影响中央区域的大起伏
			subBass: 4.0,
			// 低频高度，主要跟随鼓点和低音起伏
			bass: 3.0,
			// 中低频高度，补充地形整体层次
			lowMid: 2.0,
			// 中频高度，影响流动感较强的区域
			mid: 2.5,
			// 中高频高度，影响外围零散跳动
			highMid: 2.0,
			// 高能量瞬间的随机尖峰高度
			energy: 4.0,
			// 普通点击/音频涟漪高度
			ripple: 3.0,
			// 白色强调涟漪高度
			rippleAccent: 1.0,
		},
		// 想要红色：用 #ff4444
		// 想要透明度：别塞进 rippleColor，单独加一个 rippleOpacity 或 rippleAlpha
		theme: {
			base1: "#000000",
			base2: "#000000",
			coolCore: "#16b8c9",
			coolEdge: "#69dce7",
			warmCore: "#8be8ee",
			warmEdge: "#d9ffff",
			rippleColor: "#3bcbd9",
			// 波纹冷暖锚点：安静/低频偏冷、明亮/高频偏暖，与地形冷暖同步联动
			rippleCool: "#3bcbd9",
			rippleWarm: "#d9ffff",
			fogColor: "#050810",
			glowIntensity: 0.86,
		},
	},
};
