# SEO Titles Update Script for 34 Blog Pages
# This script updates title, og:title, h1, and JSON-LD headline for all blog pages

$seoTitles = @{
    "anhui.html" = "安徽婚俗完全指南 - 传统婚礼流程、彩礼习俗与禁忌详解";
    "aomen.html" = "澳门婚俗完全手册 - 中葡合璧的回澳祖地婚礼与传统彩礼";
    "beijing.html" = "北京婚俗完全指南 - 皇城根下的传统婚礼与京城新俗";
    "chongqing.html" = "重庆婚俗完全手册 - 巴渝文化中的传统婚礼与现代融合";
    "fujian.html" = "福建婚俗完全指南 - 闽南古礼、闽西客家与闽北风俗的婚礼传统";
    "gansu.html" = "甘肃婚俗完全手册 - 丝路文化中的传统婚礼与多民族融合";
    "guangdong.html" = "广东婚俗完全指南 - 粤式传统婚礼、过大礼与回门习俗详解";
    "guangxi.html" = "广西婚俗完全手册 - 12个民族的多彩传统婚礼与民俗习俗";
    "guizhou.html" = "贵州婚俗完全指南 - 苗侗彝布的传统婚礼与民族特色习俗";
    "hainan.html" = "海南婚俗完全手册 - 黎苗传统、海派风俗与现代海南婚礼";
    "hebei.html" = "河北婚俗完全指南 - 燕赵风俗、京冀差异与传统婚礼流程详解";
    "heilongjiang.html" = "黑龙江婚俗完全手册 - 东北豪爽、满族传统与现代冰城婚礼";
    "henan.html" = "河南婚俗完全指南 - 中原文化、豫东豫西差异与传统婚礼习俗";
    "hubei.html" = "湖北婚俗完全手册 - 荆楚古礼、鄂西民俗与现代武汉婚礼";
    "hunan.html" = "湖南婚俗完全指南 - 湘西民俗、苗族传统与现代长沙婚礼";
    "jiangsu.html" = "江苏婚俗完全手册 - 江南古礼、苏州传统与现代南京婚礼";
    "jiangxi.html" = "江西婚俗完全指南 - 赣南客家、瓦罐汤与传统抹黑脸习俗详解";
    "jilin.html" = "吉林婚俗完全手册 - 朝鲜族传统、延边特色与现代吉林婚礼";
    "liaoning.html" = "辽宁婚俗完全指南 - 满族旗袍、酸菜白肉与东北传统婚礼";
    "neimenggu.html" = "内蒙古婚俗完全手册 - 蒙古族传统、拜火仪式与全羊宴文化";
    "ningxia.html" = "宁夏婚俗完全指南 - 回族尼卡哈、撒喜仪式与清真婚宴文化";
    "qinghai.html" = "青海婚俗完全手册 - 藏族献哈达、土族婚礼歌与多民族融合";
    "shaanxi.html" = "陕西婚俗完全指南 - 周礼遗风、唢呐迎亲与陕北传统婚俗";
    "shandong.html" = "山东婚俗完全手册 - 儒家传统、万紫千红与胶东压床习俗";
    "shanghai.html" = "上海婚俗完全指南 - 海派风俗、十里红妆与现代摩登婚礼";
    "shanxi.html" = "山西婚俗完全手册 - 晋商文化、八碟八碗与传统山西婚礼";
    "sichuan.html" = "四川婚俗完全指南 - 坝坝宴、闹洞房与蜀绣秀禾传统";
    "taiwan.html" = "台湾婚俗完全手册 - 闽南传统、六礼仪式与现代台北婚礼";
    "tianjin.html" = "天津婚俗完全指南 - 换盅仪式、子孙桶与八大碗婚宴文化";
    "xianggang.html" = "香港婚俗完全手册 - 过大礼、大妗姐与中西合璧的维港婚礼";
    "xinjiang.html" = "新疆婚俗完全指南 - 维吾尔尼卡哈、麦西热甫与多民族婚礼";
    "xizang.html" = "西藏婚俗完全手册 - 献哈达、喝青稞酒与神圣的藏族婚礼";
    "yunnan.html" = "云南婚俗完全指南 - 白族掐新娘、傣族拴线与25民族婚礼";
    "zhejiang.html" = "浙江婚俗完全手册 - 十里红妆、女儿酒与江南传统婚礼";
}

$updated = 0
$failed = 0

foreach ($file in $seoTitles.Keys) {
    $filePath = "blog\$file"
    $newTitle = $seoTitles[$file]
    
    if (-not (Test-Path $filePath)) {
        Write-Host "❌ $file - 文件不存在"
        $failed++
        continue
    }
    
    try {
        $content = [System.IO.File]::ReadAllText($filePath, [System.Text.UTF8Encoding]::new($false))
        $originalContent = $content
        
        # Update <title> tag
        $content = $content -replace '<title>[^|]*\| wedding-tv\.cn</title>', "<title>$newTitle | wedding-tv.cn</title>"
        
        # Update og:title
        $content = $content -replace 'property="og:title" content="[^"]*"', "property=`"og:title`" content=`"$newTitle`""
        
        # Update <h1>
        $content = $content -replace '<h1>[^<]*</h1>', "<h1>$newTitle</h1>"
        
        # Update JSON-LD headline
        $content = $content -replace '"headline":"[^"]*"(?=,"author")', "`"headline`":`"$newTitle`""
        
        # Only write if content changed
        if ($content -ne $originalContent) {
            [System.IO.File]::WriteAllText($filePath, $content, [System.Text.UTF8Encoding]::new($false))
            Write-Host "✓ $file"
            $updated++
        } else {
            Write-Host "⚠ $file - 未找到要替换的内容"
        }
    } catch {
        Write-Host "❌ $file - 错误: $_"
        $failed++
    }
}

Write-Host ""
Write-Host "========================================="
Write-Host "✅ 成功更新: $updated 个文件"
if ($failed -gt 0) {
    Write-Host "❌ 失败/跳过: $failed 个文件"
}
Write-Host "========================================="
