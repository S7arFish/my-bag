import type { SponsorConfig } from "../types/config";

export const sponsorConfig: SponsorConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "赞助",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "感谢您的支持，您的赞助将帮助我持续创作优质内容",

	// 赞助用途说明
	usage: "",

	// 是否显示赞助者列表
	showSponsorsList: false,

	// 赞助方式列表
	methods: [],

	// 赞助者列表（可选）
	sponsors: [],
};
