# 生成 4 个国际婚俗 blog 页面
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$pages = @(
  @{
    slug='thailand'; cn='泰国'; zoneCN='东南亚'; zoneEn='Southeast Asia'; emoji='🇹🇭'
    titleSub='拜堂洒圣水、聘金 Sin Sod 与佛教婚礼'
    desc='泰国婚俗完全手册：佛教僧侣祝福、洒圣水（Rod Nam Sang）、聘金 Sin Sod 议价、九对长老牵手仪式（Sai Monkhol）、传统泰服 Chut Thai 与现代度假婚礼指南。'
    keywords='泰国婚俗,泰国结婚习俗,泰国婚礼流程,Sin Sod,洒圣水,东南亚婚俗'
    intro='本文整理泰国传统婚礼的完整流程，包括<strong>提亲议聘金、僧侣祝福、洒圣水仪式、洞房礼</strong>等核心环节，以及在普吉、苏梅、清迈办目的地婚礼时需要了解的本地礼节与禁忌。'
    facts=@(
      @{k='地区'; v='东南亚 · 泰国'}
      @{k='传统服饰'; v='Chut Thai 泰式婚服（金色丝绸）'}
      @{k='核心仪式'; v='Khan Maak 聘礼游行 + Rod Nam Sang 洒圣水'}
      @{k='聘金 Sin Sod'; v='10 万 - 500 万泰铢不等'}
    )
    sections=@(
      @{h='一、泰国婚俗的文化背景'; p=@(
        '泰国 95% 人口信仰<strong>南传上座部佛教</strong>，婚礼仪式的核心由佛教祝福与传统泰族（Thai）民俗共同构成。法律上，泰国结婚必须到县政府（Amphoe）登记，但绝大多数家庭仍会先举办传统宗教仪式，再去办法律登记。',
        '泰国婚俗最显著的特色是<strong>"佛教 + 王室皇家礼仪"</strong>的双重影响——许多典礼细节直接借鉴自王室婚礼的程序，如九对长老的 Sai Monkhol（神圣白线）牵手礼。'
      )}
      @{h='二、聘金 Sin Sod：婚礼最关键的谈判'; p=@(
        '<strong>Sin Sod</strong>（สินสอด）是泰国婚礼中男方付给女方家庭的聘金，是对女方父母养育之恩的"补偿"。金额因女方学历、家庭地位、外貌差异极大：普通家庭 10-50 万泰铢（约 2-10 万人民币），中产 100-300 万泰铢，社会名流可达 500 万泰铢以上。',
        '在订婚仪式（Thong Mun）上，男方需用银盘装上现金、金饰、聘礼品，由长者带领游行队伍（Khan Maak）送至女方家。一路敲锣打鼓，亲友唱跳助兴。女方父母收下聘礼后清点展示，象征男方诚意与体面。',
        '现代趋势：许多泰国家庭已不再实际收取 Sin Sod，仅作仪式性展示，事后退还或作为新人创业基金。但"展示"环节本身不可省略。'
      )}
      @{h='三、洒圣水礼（Rod Nam Sang）：泰国婚礼最重要的祝福'; p=@(
        '婚礼当天清晨，新人身着传统泰服跪坐在低矮平台上，双手合十伸向前方装满圣水的银碗。先由 9 位（或 7 位）家族长老、僧侣代表依次将<strong>圣水浇淋在新人双手</strong>上，口中念诵祝福语。圣水从手腕流入银碗，象征福气长流。',
        '随后新人头戴<strong>Mongkol（蒙考）</strong>——一对用神圣白线（Sai Monkhol）连接的圆形头环，代表两人从此命运相连。这条白线必须在僧侣念完<strong>巴利语经文</strong>祝福后才能解开。',
        '洒圣水礼通常持续 1-2 小时，到场的长辈、亲友、贵宾都可以参与浇水祝福。"浇水的人越多，新人福气越大"。'
      )}
      @{h='四、僧侣早课与功德回向'; p=@(
        '虔诚的泰国家庭还会在婚礼前一天<strong>邀请 9 位僧侣到家中诵经</strong>（数字 9 在泰语中谐音"前进"为吉数）。婚礼日清晨 6:00-7:00 由新人为僧侣端上早餐供养（Tak Bat），向佛祖回向功德，祈求婚姻顺遂。',
        '此环节费用：包僧侣 5000-15000 泰铢/9 人，加上供养食物约 1 万泰铢总预算。在曼谷、清迈的高档酒店多可代为安排。'
      )}
      @{h='五、洞房礼（Send to the Bridal Chamber）'; p=@(
        '夜晚由长老或父母带新人进入新房，长辈先<strong>"暖床"</strong>（坐在床上说吉祥话），再将婴儿放在床上滚一滚（求子）。新人此夜不能与父母再见，象征正式独立成家。'
      )}
      @{h='六、宴会与现代趋势'; p=@(
        '泰国婚宴菜单融合中式宴席与西式自助：必有<strong>椰汁咖喱、青木瓜沙拉、芒果糯米饭</strong>，海岛婚礼则以海鲜烧烤为主。新人与宾客一起跳 <strong>Ramwong（朗翁舞）</strong>，气氛热烈。',
        '近年中国新人到普吉、苏梅、皮皮岛办<strong>目的地婚礼</strong>非常流行：海滩泰式仪式 + 西式晚宴预算约 5-15 万人民币（含 30 位宾客的酒店住宿）。'
      )}
    )
    faqs=@(
      @{q='中国人能在泰国合法登记结婚吗？'; a='可以。需先在中国驻泰国大使馆办理"婚姻状况证明"（约 2-3 天），再到泰国任意 Amphoe（县政府）办理结婚登记。整体周期 5-7 个工作日。登记后还需回中国驻泰使馆做认证，回国凭认证文件办理国内结婚登记。'}
      @{q='泰国婚礼的 Sin Sod 聘金是必须的吗？'; a='传统上必须有，但现代很多泰国家庭只做仪式展示、事后退还。重点是"面子"——必须在订婚仪式上以银盘端出现金或金饰展示给亲友。预算紧张可与女方家庭协商象征性金额（如 99,999 泰铢吉利数字）。'}
      @{q='泰国海岛目的地婚礼费用大概多少？'; a='普吉/苏梅 30 人规模的海滩婚礼：场地+布置 2-5 万人民币，泰式仪式（含僧侣、长老、传统泰服）1-2 万，餐饮酒水 3-6 万，新人+宾客住宿 3-8 万，整体 10-20 万人民币。淡季（5-10 月）价格可降 30%。'}
      @{q='婚礼当天需要请多少位僧侣？什么时间？'; a='传统选 9 位（最吉）、退求 7 位或 5 位。仪式安排在清晨 6:30-9:00（佛教戒律要求僧侣中午前进食）。如选黄昏婚礼则提前一天清晨完成僧侣诵经环节。'}
      @{q='泰国婚礼的禁忌和注意事项有哪些？'; a='①女性不可触碰僧侣或递物给僧侣（要交给男性中介或放桌上）；②进入寺庙或新人家中要脱鞋；③避免穿黑色（丧服色）；④婚礼日期避开佛教大斋戒月（Khao Phansa 入夏安居期，7-10 月部分日期）；⑤摄影时不要让镜头高于佛像。'}
    )
    related=@(
      @{href='/blog/vietnam.html'; text='📍 越南婚俗 - 同属东南亚'}
      @{href='/blog/indonesia.html'; text='📍 印尼婚俗 - 同属东南亚'}
      @{href='/blog/yunnan.html'; text='📍 云南婚俗 - 与泰族同源傣族'}
      @{href='/blog/guangxi.html'; text='📍 广西婚俗 - 壮泰民族同源'}
    )
  },
  @{
    slug='vietnam'; cn='越南'; zoneCN='东南亚'; zoneEn='Southeast Asia'; emoji='🇻🇳'
    titleSub='áo dài、问名（Lễ Dạm Ngõ）与迎亲（Lễ Rước Dâu）'
    desc='越南婚俗完全手册：传统三书六礼、áo dài 国服、Lễ Dạm Ngõ 问名礼、Lễ Hỏi 订婚、Lễ Rước Dâu 迎亲、敬祖宗（Lễ Gia Tiên）与河内、胡志明市的现代婚礼实践。'
    keywords='越南婚俗,越南结婚习俗,越南婚礼流程,áo dài,东南亚婚俗,Lễ Rước Dâu'
    intro='越南婚俗深受儒家文化与本土百越传统融合影响，仍保留<strong>问名（Dạm Ngõ）、订婚（Hỏi）、迎亲（Rước Dâu）</strong>三段式古礼，与中国南方汉族婚俗高度相似又自成体系。本文系统介绍越南婚礼全流程。'
    facts=@(
      @{k='地区'; v='东南亚 · 越南'}
      @{k='传统服饰'; v='áo dài 越式长袍（新娘多穿红色）'}
      @{k='核心仪式'; v='Lễ Gia Tiên 敬祖宗 + Lễ Rước Dâu 迎亲'}
      @{k='聘礼数量'; v='5、7、9、11 盘（取单数）'}
    )
    sections=@(
      @{h='一、越南婚俗的儒家底色与本土特色'; p=@(
        '越南由于历史上千年汉化，婚俗骨架与中国汉族<strong>"六礼"</strong>几乎一致——纳采、问名、纳吉、纳征、请期、亲迎。当代简化为<strong>问名（Dạm Ngõ）→订婚（Hỏi）→迎亲（Rước Dâu/Cưới）</strong>三大典礼。',
        '与中国不同的是，越南婚礼<strong>敬祖宗仪式（Lễ Gia Tiên）</strong>必须在祖宗牌位前由长辈点香、新人跪拜，仪式严肃，是越南婚礼最神圣的环节。'
      )}
      @{h='二、问名礼（Lễ Dạm Ngõ）：求婚的第一次正式登门'; p=@(
        '男方父母带媒人到女方家"<strong>问名字、问八字</strong>"，礼品通常是槟榔、茶叶、米酒、糕点。女方父母如同意，会让女儿出来奉茶，男女双方正式确立<strong>未婚夫妻</strong>关系。这一步相当于中国的"提亲"。'
      )}
      @{h='三、订婚礼（Lễ Hỏi）：聘礼游行最隆重的环节'; p=@(
        '订婚日男方家族组织<strong>聘礼游行队</strong>（Đoàn Bê Tráp）：5、7、9 或 11 位未婚青年（与新娘家迎接的未婚少女数量对应）穿红色 áo dài，每人头顶一个红色聘礼盒（Tráp），里面装<strong>槟榔与蒌叶（必备）、茶叶、酒、四五味糕点、烤乳猪、龙凤喜饼</strong>等。',
        '盘数必须是单数，因越南文化认为单数为阳，代表"成双"的未来。常见配比：①5 盘（基础版）；②7 盘（中等）；③9 盘（隆重）；④11 盘（豪华）。',
        '聘礼送达后，新人面对祖宗牌位行<strong>敬祖宗礼（Lễ Gia Tiên）</strong>，点香、跪拜、汇报婚事，请求祖宗保佑。这一刻视为正式订婚。'
      )}
      @{h='四、迎亲礼（Lễ Rước Dâu）：婚礼当天的高潮'; p=@(
        '婚礼当天清晨，新郎带亲友团到新娘家。先<strong>敬女方祖宗</strong>，再正式接走新娘。新娘出门时由父母亲手交付，<strong>不能回头看</strong>（与中国习俗一致）。',
        '抵达男方家后再次<strong>敬男方祖宗</strong>，新人向男方长辈逐一敬茶，长辈回赠红包（lì xì）或金饰。整个迎亲仪式持续 3-4 小时。'
      )}
      @{h='五、婚宴：áo dài 红裙与法式融合菜'; p=@(
        '越南婚宴菜单具有<strong>"中式宴席 + 法殖民影响"</strong>特色：必有<strong>春卷（Gỏi cuốn）、河粉、清蒸鱼、烤乳猪、糯米饭</strong>，配法式法棍开胃。河内、胡志明市的高档婚宴还会上鹅肝、红酒。',
        '新娘在婚礼当天会更换 3-4 套礼服：早上传统红色 áo dài，敬祖宗用；正午迎亲穿白色 áo dài；晚宴换西式白纱；敬酒时换短款敬酒服。'
      )}
      @{h='六、现代越南婚礼新趋势'; p=@(
        '<strong>"裸婚化"</strong>趋势明显：年轻一代简化聘礼盘数（甚至象征性 3 盘）、不要彩礼、合并订婚与婚礼同日完成。',
        '<strong>中越跨国婚礼</strong>逐年增加，常采用"两地办两场"——在越南办传统 áo dài 婚礼，在中国办中式三书六礼或西式酒店婚礼。'
      )}
    )
    faqs=@(
      @{q='中国男方与越南女方结婚需要什么手续？'; a='①中方提供单身证明（民政局开具，再去外事办做领事认证，最后送越南驻华使馆认证）；②到越南女方户籍所在地省级司法局申请结婚登记，提交健康证明、出生证明、单身证明等；③等待审批（30-60 天）；④领取越南结婚证；⑤回中国凭越南结婚证办理国内结婚登记。'}
      @{q='越南订婚的聘礼一般多少钱？'; a='聘礼盒数量从 5 盘起，单盘价值 200-2000 元人民币不等。5 盘基础版总价约 5000-1 万元，9 盘标准版约 1.5-3 万元，11 盘豪华版 4-8 万元。另外现金聘金（"sính lễ"）通常 3000-3 万元人民币象征性表示，越南家庭普遍不索要高额彩礼。'}
      @{q='越南婚礼一定要穿 áo dài 吗？'; a='强烈建议但不强制。áo dài 是越南国服，在敬祖宗（Lễ Gia Tiên）这一最神圣环节必须穿传统服饰（红色绣龙凤）。其他环节可换西式婚纱或现代款 áo dài。越南本地一套订做 áo dài 价格约 1500-5000 元人民币。'}
      @{q='越南婚礼有哪些禁忌？'; a='①婚礼日期避开农历七月（鬼月）与单数月；②怀孕的新娘不能在祖宗面前行礼；③新娘出门后不能回头看；④鞋子不能带新的进门要换旧的（避免"开新走"）；⑤数字 4 在越南也是禁忌（与"死"近音）。'}
      @{q='在越南办婚礼大概多少钱？'; a='胡志明市/河内 200 人婚宴：场地（酒店宴会厅）2-5 万元，餐饮（含酒水）4-8 万元，婚礼策划（含 áo dài、化妆、摄影）2-4 万元，整体 10-20 万元人民币。中部岘港海滩婚礼 50 人规模约 5-10 万元。'}
    )
    related=@(
      @{href='/blog/thailand.html'; text='📍 泰国婚俗 - 同属东南亚'}
      @{href='/blog/indonesia.html'; text='📍 印尼婚俗 - 同属东南亚'}
      @{href='/blog/guangxi.html'; text='📍 广西婚俗 - 与京族同源'}
      @{href='/blog/yunnan.html'; text='📍 云南婚俗 - 越南边境相邻'}
    )
  },
  @{
    slug='indonesia'; cn='印度尼西亚'; zoneCN='东南亚'; zoneEn='Southeast Asia'; emoji='🇮🇩'
    titleSub='爪哇 Siraman 沐浴礼、巴厘岛印度教婚礼与穆斯林婚仪'
    desc='印尼婚俗完全手册：爪哇 Siraman 沐浴礼、Midodareni 守夜、巴厘岛印度教 Mekala-kalaan 仪式、伊斯兰 Akad Nikah 婚约、Adat 传统服饰与多民族跨宗教婚礼实践。'
    keywords='印尼婚俗,印度尼西亚结婚习俗,爪哇婚礼,巴厘岛婚礼,Siraman,Akad Nikah,东南亚婚俗'
    intro='印度尼西亚由 17000 多个岛屿、300 多个民族组成，婚俗呈现极强的<strong>多元宗教与民族融合</strong>特色。本文以最具代表性的<strong>爪哇族婚俗（Pernikahan Adat Jawa）、巴厘岛印度教婚礼、苏门答腊穆斯林婚仪</strong>三大主线展开介绍。'
    facts=@(
      @{k='地区'; v='东南亚 · 印度尼西亚'}
      @{k='主要民族婚俗'; v='爪哇族、巴厘印度教、米南加保'}
      @{k='核心仪式'; v='Siraman 沐浴礼 + Akad Nikah 婚约'}
      @{k='传统服饰'; v='Kebaya（女）+ Beskap（男）'}
    )
    sections=@(
      @{h='一、印尼婚俗的多元背景'; p=@(
        '印尼 87% 人口是<strong>穆斯林</strong>（世界最大穆斯林国家），10% 基督教，2% 印度教（主要在巴厘岛），1% 佛教与原住民信仰。法律上印尼婚姻必须依据双方宗教仪式办理，跨宗教结婚极复杂。',
        '尽管宗教不同，印尼各民族普遍保留<strong>"Adat"（习俗法）</strong>仪式——这是印尼语对民族传统礼仪的统称。爪哇族 Adat 最完整，分 8 大环节，是其他民族借鉴的标杆。'
      )}
      @{h='二、爪哇婚礼：Siraman 沐浴礼是灵魂'; p=@(
        '<strong>Siraman</strong>（沐浴礼）在婚礼前一天举行，意为"洗去单身、迎接神圣婚姻"。新郎新娘分别在各自家中由<strong>7 位长辈</strong>用装在<strong>7 种花瓣（玫瑰、茉莉、香兰、依兰等）</strong>的圣水依次浇淋，从头顶到脚尖。',
        '随后是<strong>Midodareni 守夜礼</strong>——新娘当夜被关在房间内，象征"天上仙女降临人间"。新郎只能在门外与岳父岳母对话，不能见新娘。第二天的婚礼当天，新人首次见面即在祭坛上完成婚约。',
        '婚礼当天有 <strong>Panggih</strong>（迎面礼）：新人在祭坛前互掷<strong>槟榔叶</strong>，新郎踩碎装有黄豆与红辣椒的鸡蛋（象征丈夫责任），新娘洗他的脚（象征妻子的敬重）。'
      )}
      @{h='三、巴厘岛印度教婚礼：Mekala-kalaan 净化礼'; p=@(
        '巴厘印度教婚礼极具仪式感。婚礼前在家庙（Sanggah）由<strong>祭司（Pemangku）</strong>主持 <strong>Mekala-kalaan</strong>（净化礼）：',
        '新人手持铜钱穿过象征"邪恶"的草编门，砍断绳索代表斩断单身；用<strong>圣水（Tirta）</strong>三次浇手浇头；佩戴神圣黄白线腰带；最后一同跪拜家神（Kawitan）请求祖灵接纳。',
        '巴厘婚礼平均需要<strong>7-15 位祭司</strong>，举行 1-3 天。仪式时间必须由婆罗门祭司根据<strong>巴厘农历（Pawukon）</strong>挑选吉日。'
      )}
      @{h='四、穆斯林婚约（Akad Nikah）：印尼婚礼的法律核心'; p=@(
        '伊斯兰婚约（Akad Nikah/Ijab Kabul）是穆斯林婚礼的<strong>核心环节也是法律生效时刻</strong>。仪式由<strong>Penghulu（婚姻官）</strong>主持，新娘父亲或代表（Wali）将新娘"交付"给新郎：',
        '①Wali 用阿拉伯语向新郎宣读 <strong>Ijab</strong>（婚约提议，含彩礼 Mahar 金额）；②新郎一口气说出 <strong>Kabul</strong>（接受）；③2 位男性证婚人确认。整个过程必须不间断完成。',
        'Mahar（彩礼）金额双方议定，常见 5-10 克黄金或 5-50 万印尼盾（约 230-2300 元人民币），更多是<strong>象征意义</strong>而非财富展示。'
      )}
      @{h='五、Resepsi 婚宴：千人露天大宴'; p=@(
        '正式仪式后举办的 <strong>Resepsi（婚宴）</strong>是亲友狂欢的环节。爪哇传统婚宴通常邀请 500-2000 人，新人着金色 Kebaya/Beskap 站在<strong>婚礼舞台（Pelaminan）</strong>上接受逐位宾客拥抱与照相，宴会持续 4-6 小时。',
        '菜单：<strong>Nasi Kuning（黄姜饭）、Rendang（仁当牛肉）、Sate（沙嗲烤串）、Gado-Gado（沙拉）</strong>+ 各种 Kue（糕点）。'
      )}
      @{h='六、现代印尼婚礼与中国新人到巴厘办婚礼'; p=@(
        '巴厘岛已成为中国新人海外目的地婚礼的热门选择。<strong>乌鲁瓦图（Uluwatu）悬崖教堂、努沙杜瓦（Nusa Dua）五星酒店海滩</strong>是经典场地。30 人规模的西式海岛婚礼预算 8-20 万人民币（含 5 天行程）。',
        '注意：印尼法律不承认中国民政局结婚证，仅承认本地宗教仪式 + 民事登记。在巴厘办的婚礼属"仪式婚礼"，回中国后必须重新民政登记。'
      )}
    )
    faqs=@(
      @{q='中国人能在印度尼西亚合法登记结婚吗？'; a='非常困难。印尼法律要求婚姻必须按双方共同宗教仪式办理（伊斯兰、基督教、印度教、佛教等），且双方信仰要一致或一方改宗。中国人多数是"无宗教"，无法满足要求。实务上建议在中国先完成法律登记，再到印尼办仪式婚礼（不具法律效力但具庆典意义）。'}
      @{q='巴厘岛海岛婚礼具体费用？'; a='典型 30-50 人规模 3 天行程：①场地（悬崖教堂或海滩）3-8 万元人民币；②西式仪式策划+布置 3-5 万；③晚宴餐饮 2-5 万；④新人婚纱+摄影 2-4 万；⑤宾客酒店住宿 5-15 万。总计 15-35 万元。雨季（11-3 月）有 15-30% 折扣。'}
      @{q='印尼穆斯林婚礼的彩礼 Mahar 是多少？'; a='Mahar 重在象征意义而非数额，可低至象征性的"古兰经一本+念珠一串"。普通爪哇/苏门答腊家庭常见 5-10 克黄金（约 2500-5000 元人民币），城市中产 50-100 克黄金（2.5-5 万元）。极少超过 200 克。'}
      @{q='参加印尼婚礼穿什么？有什么禁忌？'; a='①女性建议穿当地 Kebaya（蕾丝长裙）或长袖长裤套装，避免裸露肩膀大腿；②穆斯林婚礼女性需戴头巾（hijab）；③巴厘印度教婚礼参观祭祀区域需穿 Sarong（沙笼）腰布；④不要用左手递物（左手在伊斯兰文化中不洁）；⑤红包用印尼盾，金额选末尾带 7 或 9 的吉利数字。'}
      @{q='印尼婚礼的 Siraman 沐浴礼游客可以参与吗？'; a='Siraman 是家族私密仪式，外国宾客通常只能观礼不参与浇水。但巴厘岛许多酒店推出"游客版 Siraman 体验仪式"作为蜜月项目（约 500-2000 元人民币/对）。完整真实仪式需通过当地婚礼策划公司联系民族家庭安排。'}
    )
    related=@(
      @{href='/blog/thailand.html'; text='📍 泰国婚俗 - 同属东南亚'}
      @{href='/blog/vietnam.html'; text='📍 越南婚俗 - 同属东南亚'}
      @{href='/blog/dubai.html'; text='📍 迪拜婚俗 - 同属穆斯林婚仪'}
      @{href='/blog/xizang.html'; text='📍 西藏婚俗 - 同有印度教文化影响'}
    )
  },
  @{
    slug='dubai'; cn='迪拜（阿联酋）'; zoneCN='中东'; zoneEn='Middle East'; emoji='🇦🇪'
    titleSub='Henna 海娜彩绘、男女分席宴与阿拉伯穆斯林婚礼'
    desc='迪拜婚俗完全手册：Mahr 聘金、Katb Al-Kitab 婚约仪式、Henna 海娜彩绘之夜、男女分席宴会、阿联酋传统服饰 Abaya 与 Kandura、七星帆船酒店目的地婚礼实践。'
    keywords='迪拜婚俗,阿联酋结婚习俗,阿拉伯婚礼,Mahr 聘金,Henna 仪式,中东婚俗,Katb Al-Kitab'
    intro='迪拜与阿联酋婚礼以<strong>豪华、私密、严格性别分离</strong>著称。本文系统介绍阿拉伯穆斯林婚礼的<strong>Mahr 聘金、Katb Al-Kitab 婚约、Henna 之夜、Walima 宴会</strong>等核心环节，以及外国新人到迪拜办海岛/沙漠主题婚礼的实务指南。'
    facts=@(
      @{k='地区'; v='中东 · 阿联酋'}
      @{k='传统服饰'; v='Kandura（白袍·男）+ Abaya（黑袍·女）'}
      @{k='核心仪式'; v='Katb Al-Kitab 婚约 + Henna 之夜 + Walima 宴会'}
      @{k='聘金 Mahr'; v='10 万 - 500 万迪拉姆不等'}
    )
    sections=@(
      @{h='一、阿联酋婚俗的伊斯兰底色'; p=@(
        '阿联酋是<strong>逊尼派穆斯林国家</strong>，婚礼必须严格遵循<strong>沙里亚法（Sharia）</strong>。法律上结婚双方必须有：①新娘父亲或男性近亲（Wali）的同意；②至少 2 位男性穆斯林证婚人；③公开的婚约仪式；④双方议定的 <strong>Mahr（聘金）</strong>。',
        '阿联酋婚礼最大特色是<strong>严格的性别隔离</strong>——男女宾客在不同场地（或同一酒店的不同厅）举行宴会，新娘只在女宾席现身，新郎陪长辈在男宾席。'
      )}
      @{h='二、Mahr 聘金：新娘的"经济保障金"'; p=@(
        '<strong>Mahr</strong>（مهر）是伊斯兰教义规定的男方在婚约时承诺给新娘<strong>个人所有</strong>的财产（不是给新娘父母）。Mahr 分两部分：',
        '①<strong>Muqaddam</strong>（预付聘金）：婚约时一次付清，金额 1-50 万迪拉姆（约 2-100 万人民币）。',
        '②<strong>Muakhar</strong>（延付聘金）：婚约时承诺但延后支付，通常作为"<strong>离婚保险</strong>"——一旦男方提出离婚或丈夫去世，须立即支付给妻子，金额常达 100-500 万迪拉姆。',
        '阿联酋本地家庭因王室与酋长鼓励"低聘金"，最近 10 年 Mahr 平均下降到 5-10 万迪拉姆（约 10-20 万人民币），王室对结婚的本地公民还提供 7 万迪拉姆补贴。'
      )}
      @{h='三、Katb Al-Kitab 婚约：合法婚姻的诞生时刻'; p=@(
        '<strong>Katb Al-Kitab</strong>（كتب الكتاب，意为"书写婚书"）是法律婚约仪式，由<strong>Ma\u02bczun（伊斯兰婚姻官）</strong>主持，通常在新娘家或清真寺举行：',
        '①Maazun 用阿拉伯语朗读古兰经第 4 章的婚姻经文；②新娘的 Wali（监护人）代表新娘接受婚约；③新郎与 Wali 公开宣读 Mahr 金额并握手成约；④2 位男性穆斯林签字证婚；⑤Maazun 签发结婚证书（Aqd Nikah）。',
        '此后新人在法律和宗教上已为夫妻，但尚未"合礼"——按传统须等到 <strong>Zaffa（迎亲游行）</strong>与 <strong>Walima（婚宴）</strong>之后才能同居。'
      )}
      @{h='四、Henna 之夜：迪拜新娘的隆重夜礼'; p=@(
        '婚礼前 1-2 天的 <strong>Laylat Al-Henna（Henna 之夜）</strong>是新娘女性亲友的盛大聚会。新娘穿<strong>金线绣花传统长袍（Jalabiya）</strong>，由专业 Henna 艺术家在双手、双脚绘制<strong>繁复的几何与花卉图案</strong>（耗时 2-4 小时），象征美丽、好运与抵御邪眼。',
        '当晚仅限女性参加（新郎不出席），由女性鼓乐队（Daffaff）演奏，亲友跳<strong>Khaleeji 头发舞</strong>，新娘接受姑姨母女辈的祝福与红包。',
        'Henna 颜色越深越红，预示婚姻越幸福、丈夫越爱你（民俗说法）。Henna 印记可保留 2-4 周自然脱落。'
      )}
      @{h='五、Zaffa 迎亲游行 + Walima 宴会'; p=@(
        '婚礼当天，新郎在<strong>男性鼓乐队（Zaffa Band）</strong>引导下进入女宾宴会厅迎接新娘（这是新郎婚礼当天唯一进入女宾厅的时刻）。新郎将<strong>金戒指</strong>戴在新娘右手无名指上，亲吻新娘前额（不能在公众场合接吻），然后两人在亲友欢呼中离场。',
        '<strong>Walima 婚宴</strong>由男方负责举办（伊斯兰传统义务），男女分两个宴会厅同时进行。菜单包括<strong>Mandi（烤羊肉饭）、Machbous（香料米饭）、Hummus（鹰嘴豆泥）、Baklava（果仁蜜饼）</strong>，以及精致的椰枣咖啡（Gahwa）。豪华迪拜婚礼的 Walima 经常邀请 500-2000 人，预算可达 100-500 万迪拉姆。'
      )}
      @{h='六、外国新人到迪拜办目的地婚礼'; p=@(
        '迪拜是中国新人海外婚礼的热门目的地。<strong>非穆斯林</strong>外国人在迪拜办婚礼有两种方式：',
        '①<strong>纯仪式婚礼</strong>：在帆船酒店、亚特兰蒂斯、棕榈岛酒店举办西式仪式与晚宴，不办法律登记。回中国凭中方民政局结婚证为准。30 人规模预算 30-80 万人民币。',
        '②<strong>迪拜民事登记</strong>：2020 年起非穆斯林外国人可在迪拜法庭办理民事结婚（Civil Marriage），无须改宗。需提交无犯罪证明、健康证明、中方单身证明等，办理周期约 5-7 个工作日，费用约 1500-3000 迪拉姆。'
      )}
    )
    faqs=@(
      @{q='非穆斯林中国人能在迪拜办婚礼吗？'; a='可以。2020 年阿联酋出台新法律允许非穆斯林在迪拜法庭办理民事婚姻（Civil Marriage），无需改信伊斯兰教。需要：①双方护照与签证；②中国驻阿联酋使馆出具的单身证明；③健康证明；④2 位证婚人到场。整体周期 5-7 个工作日，费用 1500-3000 迪拉姆。'}
      @{q='迪拜豪华婚礼大概多少钱？'; a='帆船酒店 50 人规模婚礼：场地 25-50 万人民币（含晚宴），布置策划 10-20 万，新娘 Henna+造型 3-5 万，摄影摄像 5-10 万，宾客住宿 15-30 万（5 晚），总计 60-120 万人民币。沙漠主题婚礼（Bab Al Shams 酒店）30 人规模约 30-60 万。'}
      @{q='参加阿联酋穆斯林婚礼有什么着装要求？'; a='①女性必须穿过膝长袖长裤套装或长裙，肩膀不能裸露，部分场合需戴头巾（婚礼现场通常会提供）；②男性穿长袖衬衫长裤即可，可加西装外套；③避免穿白色（新娘色）、黑色（丧服色）、过于鲜艳的红色；④不可穿短裤、无袖背心、紧身衣进入清真寺或婚礼场地。'}
      @{q='迪拜婚礼男女分席宴会怎么操作？'; a='豪华婚礼通常租用酒店两个相邻宴会厅，女宾厅装饰花团锦簇可拍照分享，男宾厅简朴严肃以谈话为主。新娘只在女宾厅活动，新郎只在 Zaffa 迎亲那 10-15 分钟进女宾厅。两厅同步上菜，但女宾厅可以全程录像（仅限女性摄影师），男宾厅以拍合影为主。'}
      @{q='迪拜婚礼的禁忌有哪些？'; a='①公共场合不可亲吻或过度亲密；②宴会不提供酒精（部分国际酒店外国人婚礼可特批）；③婚礼日期避开斋月（Ramadan 30 天）与朝觐月（Dhul Hijjah 前 10 天）；④婚礼摄影中不可拍摄陌生穆斯林女性的面部；⑤红包用迪拉姆现金，避免送猪皮制品、酒精、香水（含酒精成分）。'}
    )
    related=@(
      @{href='/blog/indonesia.html'; text='📍 印尼婚俗 - 同属穆斯林婚仪'}
      @{href='/blog/xinjiang.html'; text='📍 新疆婚俗 - 同属穆斯林婚仪'}
      @{href='/blog/ningxia.html'; text='📍 宁夏婚俗 - 同属穆斯林婚仪'}
      @{href='/blog/gansu.html'; text='📍 甘肃婚俗 - 丝绸之路相连'}
    )
  }
)

function HtmlEnc([string]$s) { return $s -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;' -replace '"', '&quot;' }
function JsonEnc([string]$s) { return $s -replace '\\', '\\\\' -replace '"', '\"' -replace "`r", '' -replace "`n", '\n' }

foreach ($p in $pages) {
  $title = "$($p.cn)婚俗完全手册 - $($p.titleSub) | wedding-tv.cn"
  $titleNoSite = "$($p.cn)婚俗完全手册 - $($p.titleSub)"
  $url = "https://wedding-tv.cn/blog/$($p.slug).html"

  # FAQ JSON-LD
  $faqEntities = ($p.faqs | ForEach-Object {
    '{"@type":"Question","name":"' + (JsonEnc $_.q) + '","acceptedAnswer":{"@type":"Answer","text":"' + (JsonEnc $_.a) + '"}}'
  }) -join ','
  $faqJsonLd = '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[' + $faqEntities + ']}'

  $articleJsonLd = '{"@context":"https://schema.org","@type":"Article","headline":"' + (JsonEnc $titleNoSite) + '","author":{"@type":"Organization","name":"wedding-tv.cn"},"publisher":{"@type":"Organization","name":"wedding-tv.cn","url":"https://wedding-tv.cn/"},"datePublished":"2026-01-20","dateModified":"2026-05-18","mainEntityOfPage":"' + $url + '","image":"https://wedding-tv.cn/og.png","inLanguage":"zh-CN"}'

  # Sections HTML
  $sectionsHtml = ($p.sections | ForEach-Object {
    $paragraphs = ($_.p | ForEach-Object { "<p>$_</p>" }) -join "`n"
    "<h2>$($_.h)</h2>`n$paragraphs"
  }) -join "`n`n"

  # Facts HTML
  $factsHtml = ($p.facts | ForEach-Object { "  <div><strong>$($_.k)</strong>$($_.v)</div>" }) -join "`n"

  # FAQ visible HTML
  $faqHtml = ($p.faqs | ForEach-Object {
    @"
  <details style="margin:14px 0;padding:12px 14px;background:#0e0a14;border-radius:8px;border:1px solid var(--line)">
    <summary style="cursor:pointer;font-weight:600;color:var(--accent)">$($_.q)</summary>
    <p style="margin:10px 0 0;color:var(--fg);line-height:1.85">$($_.a)</p>
  </details>
"@
  }) -join "`n"

  # Related
  $relatedHtml = ($p.related | ForEach-Object { "  <a href=`"$($_.href)`">$($_.text) →</a>" }) -join "`n"

  $html = @"
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>$title</title>
<meta name="description" content="$($p.desc)" />
<meta name="keywords" content="$($p.keywords)" />
<meta name="robots" content="noindex,follow" />
<link rel="canonical" href="$url" />
<link rel="manifest" href="/manifest.webmanifest" />
<meta property="og:title" content="$titleNoSite" />
<meta property="og:description" content="$($p.desc)" />
<meta property="og:type" content="article" />
<meta property="og:url" content="$url" />
<meta property="og:image" content="https://wedding-tv.cn/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="$titleNoSite" />
<meta name="twitter:description" content="$($p.desc)" />
<meta name="twitter:image" content="https://wedding-tv.cn/og.png" />
<meta name="theme-color" content="#0e0a14" />
<script type="application/ld+json">$faqJsonLd</script>
<script type="application/ld+json">$articleJsonLd</script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>$($p.emoji)</text></svg>" />
<style>
:root{--bg:#0e0a14;--fg:#f5f1ea;--mute:#b9b1a3;--accent:#d4a574;--card:#1a1320;--line:#2a2030}
*{box-sizing:border-box}
body{margin:0;font:16px/1.85 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg)}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header.topbar{border-bottom:1px solid var(--line);background:#0a060f;position:sticky;top:0;z-index:5}
header.topbar .inner{max-width:780px;margin:0 auto;padding:14px 22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
header.topbar a.brand{font-weight:700;color:var(--fg)}
nav a{margin-left:14px;color:var(--mute);font-size:13px}
.wrap{max-width:780px;margin:0 auto;padding:36px 22px}
.crumbs{font-size:13px;color:var(--mute);margin-bottom:14px}
h1{font-size:30px;margin:0 0 12px;line-height:1.35}
.meta{color:var(--mute);font-size:13px;margin-bottom:24px;border-bottom:1px solid var(--line);padding-bottom:18px}
.meta span{margin-right:14px}
h2{font-size:21px;margin:36px 0 12px;color:var(--accent);border-left:4px solid var(--accent);padding-left:12px}
.intro{font-size:17px;color:#e8dfca;background:rgba(212,165,116,.06);padding:16px 18px;border-radius:8px;border-left:3px solid var(--accent)}
.fact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0;background:var(--card);border-radius:10px;padding:18px;border:1px solid var(--line)}
.fact-grid div{font-size:13px}
.fact-grid strong{color:var(--accent);display:block;margin-bottom:4px;font-size:12px;letter-spacing:1px}
.cta{background:linear-gradient(135deg,rgba(212,165,116,.12),var(--card));border:1px solid var(--accent);border-radius:12px;padding:20px;margin:32px 0}
.cta h3{margin:0 0 8px;color:var(--accent)}
.cta a{display:inline-block;margin:6px 6px 0 0;padding:6px 12px;background:#0e0a14;border:1px solid var(--line);border-radius:6px;font-size:13px}
.related{margin-top:36px;padding-top:24px;border-top:1px solid var(--line)}
.related h3{font-size:16px;color:var(--accent)}
.related a{display:block;padding:8px 0;border-bottom:1px solid var(--line);color:var(--fg);font-size:14px}
.related a:hover{color:var(--accent)}
footer{border-top:1px solid var(--line);margin-top:48px;padding:24px 22px;color:var(--mute);font-size:13px;text-align:center}
</style>
</head>
<body>
<header class="topbar">
  <div class="inner">
    <a class="brand" href="/">wedding-tv.cn</a>
    <nav>
      <a href="/">首页</a>
      <a href="/blog.html">博客</a>
      <a href="/almanac.html">📅 吉日</a>
      <a href="/timeline.html">⏱️ 流程</a>
      <a href="/invitation.html">💌 请帖</a>
    </nav>
  </div>
</header>
<main class="wrap">
<div class="crumbs"><a href="/">首页</a> · <a href="/blog.html">博客</a> · <a href="/blog.html#international">国际婚俗</a> · $($p.cn)</div>
<h1>$titleNoSite</h1>
<div class="meta"><span>🌍 地区：$($p.zoneCN) · $($p.zoneEn)</span><span>🗓️ 更新：2026-05</span><span>📖 阅读约 6 分钟</span></div>

<p class="intro">$($p.intro)</p>

<div class="fact-grid">
$factsHtml
</div>

$sectionsHtml

<section class="faq-section" style="margin:40px 0 24px;padding:24px;background:var(--card);border:1px solid var(--line);border-radius:12px">
  <h2 style="margin-top:0">❓ $($p.cn)婚礼常见问题</h2>
$faqHtml
</section>

<div class="cta">
  <h3>🎁 海外婚礼筹备的免费工具</h3>
  <p style="margin:0 0 8px;color:var(--mute);font-size:14px">由 wedding-tv.cn 提供，无需注册，纯前端生成：</p>
  <a href="/almanac.html">📅 婚期吉日查询</a>
  <a href="/invitation.html">💌 电子请帖</a>
  <a href="/qr-poster.html">🔗 请帖二维码海报</a>
  <a href="/timeline.html">⏱️ 婚礼流程时间轴</a>
  <a href="/playlist.html">🎵 婚礼歌单</a>
  <a href="/calculator.html">💰 预算计算器</a>
  <a href="/vows.html">💍 AI 誓词</a>
</div>

<div class="related">
  <h3><a href="/blog.html#international">查看全部国际婚俗 →</a></h3>
  <p style="margin:8px 0 12px;color:var(--mute);font-size:13px">🌍 其他$($p.zoneCN)地区婚俗：</p>
$relatedHtml
  <p style="margin:14px 0 8px;color:var(--mute);font-size:13px">📚 也欢迎了解中国 34 地婚俗：</p>
  <a href="/blog.html#regions">查看全部 34 个省/直辖市/自治区婚俗 →</a>
  <a href="/budget-reference.html">🏙️ 城市婚礼预算参考库（2026） →</a>
  <a href="/calculator.html">💰 婚礼预算计算器 →</a>
</div>

<div class="ad-slot" style="margin:28px auto;max-width:920px;padding:0 16px">
  <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-6560247681968502" data-ad-slot="9615775370" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>
</main>
<footer>© wedding-tv.cn · <a href="/privacy.html">隐私</a> · <a href="/terms.html">条款</a> · <a href="/about.html">关于</a> · <a href="/sitemap.xml">Sitemap</a></footer>
<script>
(function(){var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?1df8fda3d25e8df34a5c8e08f945e9fb";var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(hm,s);})();
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))}
</script>
</body>
</html>
"@

  $outPath = Join-Path (Get-Location) "blog\$($p.slug).html"
  [System.IO.File]::WriteAllText($outPath, $html, [System.Text.UTF8Encoding]::new($false))
  Write-Host "✓ blog/$($p.slug).html ($($html.Length) 字节)"
}

Write-Host "`n✓ 完成：4 个国际婚俗页面已生成"
