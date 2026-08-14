import type { FooterConfig } from "../types/config";

export const footerConfig: FooterConfig = {
	// 社交链接（mailto:/tel: 开头的链接不会在新标签打开）
	socialLinks: [
		{
			label: "GitHub",
			href: "https://github.com/S7arFish",
			icon: "fa7-brands:github",
		},
		{
			label: "QQ",
			href: "https://qm.qq.com/q/2R07cjGTZ0",
			icon: "fa7-brands:qq",
		},
		{
			label: "B站",
			href: "https://space.bilibili.com/435594878",
			icon: "fa7-brands:bilibili",
		},
		{
			label: "邮箱",
			href: "mailto:3425963262@qq.com",
			icon: "material-symbols:mail",
		},
	],

	// 备案信息（icp/police 留空则不显示对应条目）
	beian: {
		icp: "粤ICP备2026073665号-1",
		police: "粤公网安备44060602003342号",
		policeIcon: "/assets/images/备案图标.png",
		icpUrl: "https://beian.miit.gov.cn/#/Integrated/index",
		policeUrl: "https://beian.mps.gov.cn/#/query/webSearch?code=44060602003342",
	},

	// Powered by 信息
	poweredBy: [
		{ label: "框架", name: "Astro", href: "https://astro.build" },
		{
			label: "主题",
			name: "Firefly",
			href: "https://github.com/CuteLeaf/Firefly",
		},
	],
};
