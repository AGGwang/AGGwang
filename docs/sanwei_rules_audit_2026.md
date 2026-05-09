# 三位一体院校规则核对清单（2026）

更新时间：2026-03-12  
主索引来源（官方汇总）：https://www.zjzs.net/col/col363/

## 1. 本轮继续修订说明

1. 对“已入库但非统一硬门槛”学校继续回查官网章程，新增可结构化硬规则 4 所：  
浙江中医药大学、嘉兴大学、浙大宁波理工学院、浙江越秀外国语学院。
2. 对仍以排序入围为主的学校，补齐统一学考折算标准 2 所：  
浙江水利水电学院、温州商学院。
3. 匹配函数已新增两项能力，用于更准确比对章程规则：  
`subject_grade_point_map`（按科目差异化折算）与 `grade_total_cap`（折算分封顶）。

## 2. 系统口径分类（共 39 所）

### A. 可机读硬规则（25 所）

| 院校 | 系统口径（摘要） | 章程来源（学校官网） |
|---|---|---|
| 浙江工业大学 | OR(7A且其余>=C / 6A且其余>=C / 5A且其余>=C) | https://zs.zjut.edu.cn |
| 宁波大学 | min_grade_all=C + A10/B8/C4 + total>=80 | https://zsb.nbu.edu.cn |
| 杭州电子科技大学 | min_grade_all=D + A>=7 + A15/B10/C5 + total>=110 | https://zhaosheng.hdu.edu.cn |
| 浙江工商大学 | min_grade_all=D + A10/B8/C4 + total>=60 | https://zhaoban.zjgsu.edu.cn |
| 温州医科大学 | OR(total>=95 / total>=90)，A10/B9/C7/D4 | https://zhaosheng.wmu.edu.cn |
| 浙江农林大学 | min_grade_all=D + A15/B10/C5 + total>=90 | https://zs.zafu.edu.cn |
| 中国计量大学 | A20/B10/C0/D0 + total>=110 | https://zs.cjlu.edu.cn |
| 浙江万里学院 | 分组 OR(70/65/60) | https://zsw.zwu.edu.cn |
| 浙江科技大学 | A+B>=6 + min_grade_all=D（初审8倍排序） | https://zsb.zust.edu.cn |
| 浙江财经大学 | OR(total>=95 / total>=80)，A15/B9/C3 | https://zs.zufe.edu.cn |
| 浙大城市学院 | min_grade_all=D + total>=60 | https://zs.hzcu.edu.cn |
| 杭州师范大学 | 分组门槛口径已结构化 | https://undergrad.hznu.edu.cn |
| 湖州师范学院 | min_grade_all=D + A+B>=5 | https://zsw.zjhu.edu.cn |
| 绍兴文理学院 | min_grade_all=D + A10/B8/C6/D4 + total>=60 | https://zs.usx.edu.cn |
| 温州大学 | OR(total>=100 / >=90 / >=80)，A15/B10/C5 | https://zs.wzu.edu.cn |
| 浙江外国语学院 | OR(A>=1 / A+B>=6) + min_grade_all=D | https://zs.zisu.edu.cn |
| 杭州医学院 | OR(total>=90 / >=85)，A10/B9/C7/D4 | https://zs.hmc.edu.cn |
| 丽水学院 | min_grade_all=D + A+B>=5 | https://zsw.lsu.edu.cn |
| 嘉兴南湖学院 | OR(A>=2 / A+B>=4) + 10倍入围，A10/B7/C3/D0 | https://zsb.jxnhu.edu.cn |
| 温州肯恩大学 | min_grade_all=D + A15/B10/C5 + total>=80 | https://admission.wku.edu.cn |
| 宁波财经学院 | min_grade_all=D + A15/B9/C6/D4 + total>=60 | https://zsw.nbufe.edu.cn |
| 浙江中医药大学 | min_grade_all=D + A10/B7/C4/D0；分组门槛：82/79/70/61/67 | https://zsb.zcmu.edu.cn/info/1074/4872.htm |
| 嘉兴大学 | min_grade_all=D + A10/B8/C6/D0；分组门槛：78/75/73 | https://zsb.zjxu.edu.cn/info/1093/3062.htm |
| 浙大宁波理工学院 | min_grade_all=D + score>=60；语数外A15、其余A10，封顶100 | https://zsw.nbt.edu.cn/info/1033/3393.htm |
| 浙江越秀外国语学院 | min_grade_all=D + 英语>=B + A10/B8/C6/D4 + total>=70 | https://zs.zyufl.edu.cn/info/1016/3138.htm |

### B. 已提炼统一折算标准但主要按排序入围（7 所）

说明：这类学校有统一折算规则，但章程核心仍是“按折算分排序、按倍数入围”，非固定最低入围线。

| 院校 | 系统口径（摘要） | 章程来源（学校官网） |
|---|---|---|
| 浙江师范大学 | 折算 A10/B8/C6/D2，初审按类别排序（7倍） | https://zs.zjnu.edu.cn |
| 浙江理工大学 | 折算 A10/B8/C4/D0，初审按类别排序（11倍） | https://zs.zstu.edu.cn |
| 浙江海洋大学 | 折算 A15/B10/C6/D1，初审按类别排序（10-12倍） | https://zs.zjou.edu.cn |
| 浙江水利水电学院 | min_grade_all=D + A10/B7/C4/D0；普通类按折算分排序（6倍） | https://zhaosheng.zjweu.edu.cn/info/1076/3650.htm |
| 浙江警察学院 | 体检体测政审为关键条件，学考为组成部分 | https://www.zjjcxy.cn |
| 宁波诺丁汉大学 | 按折算分排序（7倍），另有 9A 直入条款 | https://www.nottingham.edu.cn |
| 温州商学院 | min_grade_all=D；外语A15/B12/C10/D8，其余A12/B10/C9/D7，封顶100，按折算排序（14倍） | https://zsw.wzbc.edu.cn/Art/Art_409/Art_409_135842.aspx |

### C. 待提炼（pending，不参与自动筛选）（7 所）

| 院校 | 系统口径（摘要） | 章程来源（学校官网） |
|---|---|---|
| 台州学院 | 已入库来源，待提炼初试硬门槛 | https://zs.tzc.edu.cn |
| 宁波工程学院 | 已入库来源，待提炼初试硬门槛 | https://zs.nbut.edu.cn |
| 衢州学院 | 已入库来源，待提炼初试硬门槛 | https://zsw.qzc.edu.cn |
| 湖州学院 | 已入库来源，待提炼初试硬门槛 | https://zsw.zjhzu.edu.cn |
| 温州理工学院 | 已入库来源，待提炼初试硬门槛 | https://zs.wzut.edu.cn |
| 金华职业技术大学 | 已入库来源，待提炼初试硬门槛 | https://zsw.jhc.cn |
| 宁波幼儿师范高等专科学校 | 已入库来源，待提炼初试硬门槛 | https://zsw.nbcnc.edu.cn |

## 3. 说明

1. 系统匹配仅覆盖“学考等级可机读部分”；体测、面试、政审、综合素质评价等仍在 `admission_note` 明示，最终以当年章程为准。  
2. 对 B 类学校，系统已提供统一折算分与基础条件比对，但“是否入围校测”仍取决于当年报考竞争排序。  
