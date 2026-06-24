# 生成 34 个省/直辖市/自治区/特别行政区的婚俗文章
# 用法：在仓库根目录运行 powershell -File scripts/generate-blog.ps1
# 输出：blog/{slug}.html

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "blog"
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

# 34 个地区数据：name(中文)、slug(拼音)、area(华北/华东...)、特色关键词
$REGIONS = @(
  @{n="北京";s="beijing";area="华北";brides="老北京旗袍/秀禾";dish="炸糕、龙凤喜饼、八大碗";seq="过文定 → 下大定 → 迎娶";unique="老北京讲究'三茶六礼'，迎娶时新娘需跨马鞍、火盆、铜镜，寓意平安。新郎要带'离娘肉'(一刀双方);喜宴必有'四四见底'四凉、四热、四素、四荤共十六道菜。"},
  @{n="上海";s="shanghai";area="华东";brides="海派旗袍 + 婚纱双换装";dish="八宝鸭、糖醋小排、酒酿圆子";seq="谈婚 → 订婚 → 行嫁";unique="上海婚俗深受海派文化影响，西式教堂仪式与中式敬茶并行。讲究'看人家'(双方家庭互访)、'送日脚'(择日通知)。陪嫁讲究'十里红妆'，新房布置必有红被、红枣、桂圆、莲子、花生'早生贵子'。"},
  @{n="天津";s="tianjin";area="华北";brides="秀禾、龙凤褂";dish="八大碗、罾蹦鲤鱼、贴饽饽熬小鱼";seq="相看 → 换盅 → 过礼 → 迎娶";unique="天津婚俗保留'换盅'仪式：男女双方家长在订婚宴上互换酒盅，象征联姻。彩礼讲究'四彩礼'(肉、糕、酒、果)，迎娶日新娘嫁妆中必有'子孙桶'(红漆马桶)寓意多子多福。"},
  @{n="重庆";s="chongqing";area="西南";brides="土家族西兰卡普 + 现代婚纱";dish="九大碗、夹沙肉、烧白";seq="放话 → 看人户 → 过礼 → 迎亲";unique="重庆有'哭嫁'传统(尤其在土家族聚居区)，新娘出嫁前哭嫁三天表达不舍。喜宴'九大碗'又称'三蒸九扣'，肉类居多。山城地势特殊，迎亲车队常用越野车。"},
  @{n="河北";s="hebei";area="华北";brides="老式凤冠霞帔";dish="驴肉火烧、四大件、八大碗";seq="提亲 → 相亲 → 定亲 → 通话 → 迎娶";unique="河北农村保留'压箱钱'习俗，娘家在嫁妆箱底放钱，越多越体面。婚礼当天'闹洞房'热闹非凡，宾客出题让新人完成。北部承德、张家口受满蒙影响，有'坐帐'(新娘进门坐帐三天)古礼遗风。"},
  @{n="山西";s="shanxi";area="华北";brides="晋商富贵秀禾";dish="过油肉、平遥牛肉、八大碗";seq="提亲 → 看家 → 订婚 → 通信 → 迎娶";unique="山西晋中地区婚俗保留浓厚晋商气派：嫁妆讲究'八碟八碗'+陪嫁箱柜全套。'添箱'仪式上亲友送钱物充实嫁妆。新娘进门要'跨火盆''射红箭'，洞房床上撒红枣、花生、桂圆、栗子。"},
  @{n="辽宁";s="liaoning";area="东北";brides="满族旗袍 + 红盖头";dish="酸菜白肉锅、锅包肉、小鸡炖蘑菇";seq="提亲 → 相看 → 下定 → 过彩礼 → 娶亲";unique="辽宁满族婚俗有'坐福'：新娘入门后坐在被褥上，时间越长福气越多。'三日回门'后还有'住对月'(新娘回娘家住一月)。婚宴必上酸菜白肉锅，新人要给长辈敬'改口酒'，红包数额越大越显诚意。"},
  @{n="吉林";s="jilin";area="东北";brides="朝鲜族韩服 / 满族旗袍";dish="打糕、冷面、酸菜炖排骨";seq="提亲 → 相看 → 订婚 → 迎娶 → 回门";unique="吉林延边朝鲜族婚俗独特：新郎'纳币函'(送彩礼盒)、'奠雁礼'(献木雁象征忠贞)、'交拜礼'(行四拜大礼)。喜宴必有打糕、冷面，宾客载歌载舞跳长鼓舞。汉族区域则保留东北'二人转闹洞房'传统。"},
  @{n="黑龙江";s="heilongjiang";area="东北";brides="红色棉袄秀禾 / 西式婚纱";dish="杀猪菜、得莫利炖鱼、锅包肉";seq="提亲 → 看家 → 订婚 → 迎娶";unique="黑龙江冬季婚礼独具特色：哈尔滨流行'冰雪婚礼'在零下 20 度的冰雕教堂办仪式。北方俄式婚俗影响下，部分人会喝'交杯伏特加'。婚宴'杀猪菜'必上，亲友围坐火炕，热气腾腾烘托氛围。"},
  @{n="江苏";s="jiangsu";area="华东";brides="苏绣秀禾、刺绣龙凤褂";dish="松鼠桂鱼、狮子头、糖芋苗";seq="议婚 → 相亲 → 定亲 → 行聘 → 嫁娶";unique="江苏婚俗细腻精致：苏州'六礼'保留完整(纳采、问名、纳吉、纳征、请期、亲迎)。新娘嫁妆讲究苏绣被面、漆器嫁妆箱。'压箱底'放金器。喜宴'十碗八盘'象征十全十美。无锡'撒帐歌'、扬州'三朝回门'各具地方风情。"},
  @{n="浙江";s="zhejiang";area="华东";brides="杭绣秀禾、织锦龙凤褂";dish="西湖醋鱼、东坡肉、龙井虾仁";seq="说媒 → 相亲 → 订婚 → 行聘 → 迎娶";unique="浙江各地婚俗差异大：宁波'十里红妆'极尽奢华，朱漆嫁妆从娘家排到夫家蜿蜒数里。绍兴有'三茶六礼'与'女儿酒'(出生即埋酒，出嫁取出)。温州婚礼讲究'压八仙'(新人坐定前由长辈压椅以示尊重)。"},
  @{n="安徽";s="anhui";area="华东";brides="徽州凤冠霞帔";dish="臭鳜鱼、徽州毛豆腐、八公山豆腐";seq="提亲 → 行聘 → 报日 → 嫁娶 → 回门";unique="安徽徽州婚俗保留宋明遗风，'六礼'仪式齐全。新娘出嫁前要'开脸'(用线绞除汗毛)，婚后改梳髻。徽商人家嫁妆奢华，常陪嫁'子孙宝桶'与'压箱银'。皖北蚌埠地区婚宴上'喝喜酒'要'打圈'(每桌轮流敬酒)。"},
  @{n="福建";s="fujian";area="华东";brides="泉州蟳埔簪花围 / 客家秀禾";dish="佛跳墙、海蛎煎、芋泥、红龟粿";seq="议婚 → 订盟 → 行聘 → 请期 → 迎亲";unique="福建闽南婚俗讲究'十二版'(十二样彩礼)：糖、面、龙凤烛、礼香、礼炮、礼饼等。新娘出嫁要'吃姊妹桌'(姐妹陪吃象征团圆)。客家地区婚礼保留'拦门''敬祖''跳火堆'三大环节。福州'分红蛋'寓意添丁。"},
  @{n="江西";s="jiangxi";area="华东";brides="赣式刺绣秀禾";dish="瓦罐汤、藜蒿炒腊肉、三杯鸡";seq="说媒 → 看人家 → 订亲 → 报日 → 迎娶";unique="江西婚俗保留'抹黑脸'习俗(婚礼前夜亲友给新郎抹锅灰，越黑越吉利，意为驱邪)。赣南客家地区有'拜祠堂'仪式，新人要拜祭夫家祖先。婚宴必有'瓦罐汤'寓意聚财，赣北'三朝回门'后还要'看七日'(婚后第七天再回门)。"},
  @{n="山东";s="shandong";area="华东";brides="鲁绣龙凤褂";dish="九转大肠、糖醋鲤鱼、葱烧海参、四喜丸子";seq="提亲 → 相亲 → 看家 → 通话 → 迎娶";unique="山东婚俗豪爽实在，彩礼讲究'万紫千红一片绿'(一万张五元、一千张百元、若干五十元)。婚宴必有'四喜丸子''全鱼'象征年年有余。胶东半岛'压床'习俗，由福气好的童子在新房床上滚一滚。鲁西南'闹房三天无大小'。"},
  @{n="河南";s="henan";area="华中";brides="汴绣秀禾";dish="胡辣汤、烩面、灌汤包";seq="说媒 → 相亲 → 见面礼 → 定亲 → 迎娶";unique="河南婚俗中原古朴：'相亲'后'见面礼'金额讲究'万里挑一'(一万一千)或'三家一起发'(三万一)。婚礼当日新娘要'坐花轿'象征明媒正娶(现代多为豪车)，跨火盆、过马鞍。豫南信阳婚俗受楚文化影响，喜用红伞遮盖新娘。"},
  @{n="湖北";s="hubei";area="华中";brides="楚绣秀禾、土家族西兰卡普";dish="武昌鱼、热干面、藕汤、沔阳三蒸";seq="提亲 → 相亲 → 看家门 → 报日子 → 迎娶";unique="湖北恩施土家族婚俗独有'哭嫁歌'：新娘出嫁前 7-30 天，与母亲、姐妹、姑嫂同哭。哭得越响越孝顺。婚宴'十大碗'丰盛。汉族'回门'必带'回门礼'(糖、酒、糕点)。武汉婚礼受外来文化影响较开放，西式婚礼比例高。"},
  @{n="湖南";s="hunan";area="华中";brides="湘绣秀禾、土家苗族服饰";dish="剁椒鱼头、毛氏红烧肉、湘西腊肉";seq="提亲 → 相亲 → 订婚 → 报日 → 迎娶";unique="湖南婚俗辣劲十足：湘西土家族'摸米'习俗(新娘半夜偷摸新郎家米象征带福气)。苗族'抢亲'保留象征性仪式。婚宴'三大件'(腊肉、辣椒、鱼)必备。长沙地区流行'踢门'迎亲，新郎需用脚象征性踢三下娘家门方可入内接亲。"},
  @{n="广东";s="guangdong";area="华南";brides="潮绣龙凤褂、广府裙褂";dish="大盆菜、烧乳猪、白切鸡、莲子百合糖水";seq="过文定 → 过大礼 → 安床 → 上头 → 迎亲";unique="广东婚俗最讲究'过大礼'：彩礼盒装满龙凤饼、椰子、金器、海味、利是封。'上头'是核心仪式：男女双方各自由'好命婆'梳头四次('一梳梳到尾')。新娘穿'裙褂'(广州式)或'龙凤褂'(潮汕式)。回门必带'烧猪'象征新娘清白。"},
  @{n="海南";s="hainan";area="华南";brides="黎族黎锦筒裙、汉族秀禾";dish="文昌鸡、清补凉、椰子饭、海鲜大餐";seq="提亲 → 定亲 → 报日 → 接新娘";unique="海南黎族婚俗有'放槟榔''送定'传统：男方送槟榔表达求亲意。婚礼上新娘穿黎锦筒裙、戴银项圈。汉族潮州后裔聚居区('军话区')保留闽南婚俗。当代海南婚礼海岛元素浓郁：海边草坪婚礼、椰林拍照盛行。"},
  @{n="四川";s="sichuan";area="西南";brides="蜀绣秀禾";dish="九大碗、回锅肉、麻婆豆腐、夫妻肺片";seq="提亲 → 看人户 → 烧香 → 拿期 → 过礼 → 迎亲";unique="四川婚俗热闹幽默：'坝坝宴'(露天流水席)是农村特色，全村开吃。'九大碗'(三蒸九扣)是经典菜单。'闹洞房'有'撒帐'歌谣，伴娘出'整人'游戏。川西藏区婚礼保留献哈达、青稞酒等民族元素。'打亲家'(婚后两家互访)必不可少。"},
  @{n="贵州";s="guizhou";area="西南";brides="苗族银饰盛装、侗族刺绣";dish="酸汤鱼、糟辣脆皮鱼、夹沙肉、糯米饭";seq="说亲 → 订亲 → 过礼 → 迎亲 → 回门";unique="贵州少数民族婚俗丰富多彩：苗族新娘佩戴重达 10-20 公斤的银饰，叮当作响。侗族'行歌坐月'是青年恋爱传统，'拦路歌'迎亲。布依族'撒糠'礼。婚宴必有'米酒'(三杯酒：进门酒、交杯酒、谢客酒)。汉族区域则保留'拜堂三鞠躬'古礼。"},
  @{n="云南";s="yunnan";area="西南";brides="白族凤冠、傣族筒裙、彝族擦尔瓦";dish="过桥米线、汽锅鸡、宣威火腿、烤乳扇";seq="提亲 → 看亲 → 喝定酒 → 迎娶";unique="云南 25 个少数民族婚俗各异：白族'掐新娘'(伴娘抹辣椒水使新娘脸红表喜气)、傣族'拴线礼'(长老用白线拴手腕祈福)、彝族'抢亲'象征仪式、纳西族'东巴祭拜'。汉族区域保留'三朝回门'。当代昆明、大理盛行洱海/玉龙雪山目的地婚礼。"},
  @{n="陕西";s="shaanxi";area="西北";brides="关中凤冠霞帔、唐风秀禾";dish="羊肉泡馍、肉夹馍、油泼面、八大碗";seq="说媒 → 相亲 → 订婚 → 看好日子 → 迎娶";unique="陕西婚俗周礼遗风浓厚：'六礼'保留较完整。关中农村'娶亲队伍'讲究人数('单去双回')。新娘嫁妆中'压箱底'放面食(花馍)。陕北'唢呐迎亲'声势浩大。陕南安康受楚文化影响，婚宴必上'蒸盆子'。当代西安流行'唐风汉服婚礼'，新人着唐装行汉礼。"},
  @{n="甘肃";s="gansu";area="西北";brides="回族盖头、汉族秀禾";dish="兰州牛肉面、手抓羊肉、酿皮、八宝盖碗茶";seq="提亲 → 相亲 → 定茶 → 行聘 → 迎娶";unique="甘肃婚俗融合多民族：回族'尼卡哈'(阿訇主持的伊斯兰婚礼)、汉族'拜天地'。河西走廊地区'迎亲马队'壮观。婚宴'肉份子'(整盘肉)是硬菜。临夏'回族花儿对唱'是恋爱传统。当代敦煌、张掖等地兴起'丝路风情婚礼'，骆驼、戈壁、雅丹为背景。"},
  @{n="青海";s="qinghai";area="西北";brides="藏族藏袍、土族盘绣";dish="手抓羊肉、酥油糌粑、青稞酒、酿皮";seq="提亲 → 订婚 → 送礼 → 迎娶";unique="青海婚俗多民族交融：藏族婚礼献哈达、敬青稞酒、跳锅庄。土族'纳什金'(送亲人)在婚礼上唱'婚礼曲'三天三夜。回族'尼卡哈'。汉族保留河湟传统。当代青海湖边、茶卡盐湖成为婚纱摄影圣地，目的地婚礼日益流行。"},
  @{n="台湾";s="taiwan";area="华东";brides="闽南红裙、客家秀禾";dish="米糕、红龟粿、佛跳墙、乌鱼子";seq="提亲 → 订婚 → 完聘 → 请期 → 迎娶";unique="台湾婚俗保留闽南、客家传统：'六礼'+'十二版聘礼'(冬瓜糖、桔饼、龙眼干等)。订婚日'压茶瓯'(亲友放红包于茶杯下)。新娘出门由'好命婆'撑'米筛'遮顶。婚宴必有'喜饼'分送亲友。当代台北流行'谢客宴'，西式仪式与中式订婚并行。"},
  @{n="内蒙古";s="neimenggu";area="华北";brides="蒙古族德勒袍、头戴'姑姑冠'";dish="手把肉、烤全羊、奶豆腐、马奶酒";seq="说亲 → 订婚 → 拜火 → 婚宴";unique="内蒙古蒙古族婚俗豪迈大气：'求婚'要带哈达和奶酒三次。婚礼当天新郎'抢婚'(象征性追马接新娘)。'拜火'仪式：新人共同跨过两堆火寓意爱情炽热。婚宴必有'全羊宴'，长辈唱'祝酒歌'敬'下马酒'。汉族区域(如赤峰、呼和浩特)保留华北婚俗特色。"},
  @{n="广西";s="guangxi";area="华南";brides="壮族壮锦盛装、瑶族银饰";dish="壮家五色糯米饭、白切鸡、酸笋老鸭";seq="提亲 → 订亲 → 过礼 → 迎亲 → 回门";unique="广西壮族婚俗有'歌圩对歌'传统：男女青年以歌择偶。婚礼'夜歌堂'通宵对唱山歌。瑶族'女不坐轿走着嫁'，走过山路考验体力。侗族'三朝酒'连办三天。'伞下迎亲'(用红伞接新娘)是常见礼节。当代南宁、桂林流行漓江山水主题婚纱照。"},
  @{n="西藏";s="xizang";area="西南";brides="藏族邦典彩裙、镶宝石头饰";dish="酥油茶、糌粑、藏式风干牛肉、青稞酒";seq="提亲 → 订婚 → 选吉日 → 迎亲 → 回门";unique="西藏藏族婚俗神圣庄严：婚期由喇嘛根据生辰算定。新郎家派'迎亲队伍'献哈达、奶酒接新娘。新娘到男家后跨过'吉祥地毯'(画有吉祥图案)。婚礼三天三夜：第一天迎亲、第二天庆祝、第三天送客。喝'切玛'(青稞酒+酥油)是核心仪式。"},
  @{n="宁夏";s="ningxia";area="西北";brides="回族盖头、汉族秀禾";dish="手抓羊肉、羊杂碎、八宝盖碗茶、馓子";seq="提亲 → 道喜 → 定茶 → 插花 → 娶亲";unique="宁夏回族婚礼以'尼卡哈'为核心：阿訇用阿拉伯语诵经证婚，新人当众应许。'撒喜'仪式：长辈撒红枣、花生、糖果给亲友。婚宴清真为主，'九碗三行子'是经典菜式。汉族区域保留西北婚俗。当代银川流行'黄河风情婚礼'，沙湖、沙坡头是热门外景地。"},
  @{n="新疆";s="xinjiang";area="西北";brides="维吾尔族艾德莱斯绸、哈萨克族羊毛长裙";dish="手抓饭、烤全羊、馕、葡萄干";seq="提亲 → 订亲 → 尼卡哈 → 婚宴 → 揭面纱";unique="新疆维吾尔族婚礼热情奔放：'尼卡哈'仪式后亲友载歌载舞跳'麦西热甫'，弹都塔尔、热瓦普。新娘头戴红盖头到夫家'揭面纱'仪式。哈萨克族'姑娘追'(婚前游戏)。塔吉克族'叼羊'庆祝。婚宴必有手抓饭。当代乌鲁木齐、喀什流行融合婚礼。"},
  @{n="香港";s="xianggang";area="华南";brides="潮州龙凤褂 + 西式白纱双换装";dish="大盆菜、乳猪全体、燕翅鲍参";seq="过大礼 → 上头 → 迎亲 → 注册 / 教堂仪式 → 婚宴";unique="香港婚俗中西合璧：上午'过大礼''上头''迎亲'按粤式传统进行；下午到婚姻登记处或教堂办西式仪式；晚上酒楼摆酒。'大妗姐'(资深婚礼司仪)主持中式仪式必不可少。婚宴前后要派'过大礼回礼'，喜糖盒精美。新界原居民'盆菜宴'是经典传统，全村共聚。"},
  @{n="澳门";s="aomen";area="华南";brides="葡式婚纱 / 中式裙褂";dish="葡式蛋挞、马介休、烧乳猪、燕翅汤";seq="过大礼 → 上头 → 教堂或户外仪式 → 婚宴";unique="澳门婚俗融合中葡文化：传统粤式'过大礼'与葡萄牙天主教教堂仪式并存。圣若瑟修院、玫瑰堂是热门婚礼场所。土生葡人婚俗保留欧式礼仪('父亲牵新娘走红毯')。婚宴'澳葡菜'与粤式大盆菜并陈。当代流行'澳门塔'空中宴会、'威尼斯人'酒店主题婚礼。"}
)

# 生成索引页用 — 让主调用脚本可以拼接
$INDEX_ITEMS = @()
foreach ($r in $REGIONS) {
  $name = $r.n; $slug = $r.s; $area = $r.area
  $brides = $r.brides; $dish = $r.dish; $seq = $r.seq; $unique = $r.unique
  $title = "${name}婚俗大全：从提亲到回门，老${name}人的结婚流程与禁忌"
  $shortU80 = if ($unique.Length -gt 80) { $unique.Substring(0, 80) + '...' } else { $unique }
  $shortU70 = if ($unique.Length -gt 70) { $unique.Substring(0, 70) + '...' } else { $unique }
  $desc = "完整解析${name}传统婚礼习俗：${seq}，${shortU80}"
  $kw = "${name}婚俗,${name}结婚习俗,${name}婚礼流程,${name}婚礼礼节,${area}婚俗"
  $url = "https://wedding-tv.cn/blog/$slug.html"
  $INDEX_ITEMS += "<a class='card' href='/blog/$slug.html'><span class='tag'>$area</span><h3>${name}婚俗</h3><p>${shortU70}</p><span class='go'>阅读 →</span></a>"

  $html = @"
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>$title | wedding-tv.cn</title>
<meta name="description" content="$desc" />
<meta name="keywords" content="$kw" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="$url" />
<link rel="manifest" href="/manifest.webmanifest" />
<meta property="og:title" content="$title" />
<meta property="og:description" content="$desc" />
<meta property="og:type" content="article" />
<meta property="og:url" content="$url" />
<meta property="og:image" content="https://wedding-tv.cn/og.png" />
<meta name="theme-color" content="#0e0a14" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560247681968502" crossorigin="anonymous"></script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><text y='52' font-size='52'>📚</text></svg>" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":"$title","author":{"@type":"Organization","name":"wedding-tv.cn"},"publisher":{"@type":"Organization","name":"wedding-tv.cn","url":"https://wedding-tv.cn/"},"datePublished":"2025-01-15","mainEntityOfPage":"$url","image":"https://wedding-tv.cn/og.png"}
</script>
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
<div class="crumbs"><a href="/">首页</a> · <a href="/blog.html">博客</a> · <a href="/blog.html#regions">各地婚俗</a> · ${name}</div>
<h1>${name}婚俗大全：从提亲到回门，老${name}人的结婚流程与禁忌</h1>
<div class="meta"><span>📍 地区：${area}</span><span>🗓️ 更新：2025</span><span>📖 阅读约 5 分钟</span></div>

<p class="intro">本文系统整理${name}地区的传统婚礼习俗，涵盖<strong>${seq}</strong>各环节的礼节细节、禁忌讲究，以及当代年轻人办婚礼时常被问到的"${name}本地老规矩"。无论你是即将在${name}办婚礼的新人，还是想了解中华婚俗文化的研究者，希望这篇文章对你有所帮助。</p>

<div class="fact-grid">
  <div><strong>地区</strong>${area} · ${name}</div>
  <div><strong>传统服饰</strong>${brides}</div>
  <div><strong>典型婚宴菜</strong>${dish}</div>
  <div><strong>传统流程</strong>${seq}</div>
</div>

<h2>一、${name}婚俗的核心特色</h2>
<p>${unique}</p>
<p>从清末民国到当代，${name}的婚礼习俗经历了从"父母之命、媒妁之言"到自由恋爱、再到中西合璧的演变。但传统的"<strong>明媒正娶</strong>"四个字，至今仍是许多${name}家庭办婚礼时的核心追求。无论形式如何变化，对家庭尊重、对长辈孝敬、对未来美好祝愿的核心精神始终未变。</p>

<h2>二、提亲与订婚：从陌生到一家人的开始</h2>
<p>在${name}传统婚俗中，<strong>提亲</strong>是男方家庭通过媒人或亲自登门向女方家庭表达求婚意愿的第一步。媒人(或父母代表)需带礼品上门，礼品的轻重直接影响女方家庭对男方诚意的判断。常见礼品包括烟酒糖茶四样、糕点礼盒、应季水果，部分地区还会带上"开口礼"红包。</p>
<p>女方家庭如有意，会接受礼品并安排"<strong>看人户</strong>"或"<strong>相亲</strong>"——男女双方正式见面。双方家长也借此机会了解对方家庭情况，包括家世、人品、经济条件等。一旦双方满意，便进入<strong>订婚</strong>(${name}多称"过定""下定")环节。订婚仪式上，男方需备齐订婚礼(三金或五金、订婚红包、龙凤喜饼等)，双方互换信物，宴请双方亲友共同见证。</p>

<h2>三、过礼与彩礼：体面与诚意的较量</h2>
<p>${name}的<strong>过礼</strong>(也称"过大礼""下聘礼")是婚礼前最重要的财礼仪式。彩礼数额因家庭条件、地区习俗差异较大，但普遍讲究<strong>"成双成对、好事成双"</strong>，金额避开单数和不吉利数字(如4)。在${name}部分地区，彩礼除现金外还需准备：</p>
<ul>
<li><strong>三金/五金/六金</strong>：金项链、金戒指、金耳环为基础，部分地区扩展至金手镯、金吊坠、金脚链。</li>
<li><strong>礼饼礼糖</strong>：分发给女方亲友的喜糖喜饼，数量按女方亲友圈大小定。</li>
<li><strong>四彩礼/六色礼</strong>：肉类、糕点、酒水、烟茶等成双成对的礼品。</li>
<li><strong>压箱钱</strong>：放入新娘嫁妆箱的钱，象征夫家诚意。</li>
</ul>
<p>女方家庭收到彩礼后通常会回礼——退回部分现金或赠送男方衣物鞋帽，体现"两家共出嫁妆办喜事"的态度。</p>

<h2>四、迎亲日：${name}婚礼当天的关键时刻</h2>
<p>婚礼当天的<strong>迎亲</strong>(${name}俗称"接新娘""娶亲")是整个婚礼的高潮。新郎一早带着伴郎团、车队(或马队)出发到新娘家。${name}传统讲究"<strong>单去双回</strong>"——去时车辆/人数为单数，接上新娘后变成双数，象征"添丁进口"。</p>
<p>到达新娘家后，伴郎团要应对<strong>堵门游戏</strong>：伴娘出题考验新郎诚意(常见有唱情歌、表白、做俯卧撑、回答恋爱细节等)，新郎要准备充足红包"开门"。这一环节既热闹又增进双方亲友感情，时长一般控制在 20-30 分钟。</p>
<p>新郎进门后，需向新娘父母<strong>敬茶改口</strong>：双膝跪地(或鞠躬)，奉上热茶，叫一声"爸""妈"。父母喝下茶后给新人改口红包(数额因家庭而异，常见 1001、6666、9999 等吉利数字)。随后新郎要找到藏好的<strong>新娘婚鞋</strong>，亲手为新娘穿上，这才能正式接新娘出门。</p>
<p>新娘出门时，部分${name}家庭还保留着<strong>跨火盆、过马鞍、撑红伞</strong>等古礼：跨火盆寓意烧掉过去、迎来红火日子；过马鞍取"鞍"与"安"谐音；红伞则是为新娘遮挡天上"白虎神"。新娘脚不能沾娘家土，由兄长或伴娘背上婚车。</p>

<h2>五、典礼与喜宴：见证幸福的时刻</h2>
<p>到达婚礼酒店后，新人进行<strong>正式典礼</strong>。现代${name}婚礼多采用中西结合形式：上午中式三书六礼+敬茶仪式，中午或晚上酒店西式典礼+宴会。中式仪式核心环节包括<strong>拜天地、拜高堂、夫妻对拜、共饮交杯酒</strong>。西式仪式则有<strong>新娘父亲牵手交付、誓词、戴戒指、拥吻、香槟塔</strong>等环节。</p>
<p>${name}婚宴讲究<strong>菜品丰盛、寓意吉祥</strong>：典型菜单以${dish}为代表。整桌宴席通常包含 8-12 道菜，必有一道全鱼(年年有余)、一道丸子(团团圆圆)、一道甜品(甜甜蜜蜜)。</p>
<p>开席后新人逐桌<strong>敬酒</strong>，每桌停留 2-3 分钟，向亲友表达感谢。新郎主敬白酒(部分用茶或饮料代替)，新娘陪同。敬酒时新娘需换上更便于活动的<strong>敬酒服</strong>(中式秀禾或短款礼服)。亲朋好友也会借机出题逗乐新人，气氛热烈。</p>

<h2>六、回门与三朝：婚礼之后的礼节延续</h2>
<p>${name}传统婚礼并未在婚宴结束时落幕。婚后第三天(部分地区为第二天或第九天)，新人要<strong>回门</strong>——新娘带新郎回娘家探望父母。回门讲究"<strong>来的早、走的早</strong>"——上午到、下午走，不在娘家过夜(传统上认为新娘已是"外人")。回门礼物不能少：糕点、酒水、水果四样，部分地区还要带"<strong>离娘肉</strong>"或整只烧鸡。</p>
<p>回门当天，娘家会设"<strong>回门宴</strong>"招待女婿，岳父岳母会借此机会进一步了解女婿。新郎在回门宴上要表现得体、酒桌应酬周到，给娘家留下好印象。这一环节标志着两家正式成为亲家。</p>

<h2>七、当代${name}婚礼的新趋势</h2>
<p>近年来，${name}的年轻人办婚礼越来越追求<strong>个性化、轻量化、记录化</strong>：</p>
<ul>
<li><strong>目的地婚礼/旅行结婚</strong>：选择三亚、大理、巴厘岛等地办小型婚礼，亲友 30-50 人足矣。</li>
<li><strong>简约化</strong>：跳过繁琐的彩礼讨价还价，只保留核心仪式(敬茶、誓词、宴请)。</li>
<li><strong>中式国潮</strong>：穿秀禾、龙凤褂，办全套中式三书六礼婚礼，重新拥抱传统文化。</li>
<li><strong>云直播+婚礼电影</strong>：让无法到场的亲友通过云直播观礼，婚礼当天素材剪成微电影长期保存。</li>
<li><strong>电子请帖</strong>：取代纸质请帖，节省成本且更环保。配合二维码海报朋友圈传播。</li>
</ul>
<p>无论选择哪种形式，<strong>一场用心的婚礼</strong>都是新人写给彼此的第一封情书。${name}的婚俗文化深厚悠长，希望这篇文章帮助你在传统与现代之间找到属于自己的平衡。</p>

<div class="cta">
  <h3>🎁 ${name}新人筹备婚礼的免费工具</h3>
  <p style="margin:0 0 8px;color:var(--mute);font-size:14px">由 wedding-tv.cn 提供，无需注册，纯前端生成：</p>
  <a href="/almanac.html">📅 婚期吉日查询</a>
  <a href="/invitation.html">💌 电子请帖</a>
  <a href="/qr-poster.html">🔗 请帖二维码海报</a>
  <a href="/timeline.html">⏱️ 婚礼流程时间轴</a>
  <a href="/playlist.html">🎵 婚礼歌单</a>
  <a href="/poster.html">🖼️ AI 海报</a>
  <a href="/vows.html">💍 AI 誓词</a>
  <a href="/speech.html">🎤 AI 致辞</a>
  <a href="/checklist.html">📋 筹备清单</a>
  <a href="/calculator.html">💰 预算计算器</a>
</div>

<div class="related">
<h3>📖 延伸阅读 · 各地婚俗</h3>
<a href="/blog.html#regions">查看全部 34 个省/直辖市/自治区婚俗 →</a>
</div>

</main>
<footer>© wedding-tv.cn · <a href="/">首页</a> · <a href="/blog.html">博客</a> · <a href="/sitemap.xml">Sitemap</a><br>婚礼行业品牌域名 <a href="/#contact">议价出售中 →</a></footer>
<script>
(function(){var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?1df8fda3d25e8df34a5c8e08f945e9fb";var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(hm,s);})();
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))}
</script>
</body>
</html>
"@
  $path = Join-Path $out "$slug.html"
  Set-Content -Path $path -Value $html -Encoding UTF8
  Write-Host "✅ $name -> blog/$slug.html"
}

# 输出索引片段（之后手动嵌入 blog.html）
$indexFile = Join-Path $root "blog/_index_snippet.html"
$indexContent = "<!-- 自动生成的省份卡片片段 -->`n<div class='grid' id='regions'>`n" + ($INDEX_ITEMS -join "`n") + "`n</div>"
Set-Content -Path $indexFile -Value $indexContent -Encoding UTF8
Write-Host "`n📋 已生成 $($REGIONS.Count) 篇文章 + 索引片段：blog/_index_snippet.html"
