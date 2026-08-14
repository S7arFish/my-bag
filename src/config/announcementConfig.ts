import type { AnnouncementConfig } from "../types/config";

export const announcementConfig: AnnouncementConfig = {
	// 公告标题
	title: "公告",

	// 公告列表
	items: [
		{
			tag: "欢迎",
			title: "关于我的介绍",
			content:
				"欢迎来到我的博客，我是正在学习python、c和java。热爱技术、持续学习，欢迎同好交流探讨，也欢迎大佬互换友链。",
			time: "2025-06-01",
			link: "/about/",
			sort: 1,
		},
	],

	// 是否允许用户关闭公告
	closable: true,
};
