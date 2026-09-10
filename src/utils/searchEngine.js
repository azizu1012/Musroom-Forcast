import Fuse from 'fuse.js';

/**
 * Remove Vietnamese diacritics / accents for robust phonetic and typo matching
 */
export function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Common Vietnamese aliases, provinces, and hubs abbreviations mapping
 */
const ALIAS_MAP = {
// TP.HCM Hubs & Wards
  'phường bến nghé': 'ben nghe q1 quan 1 saigon sai gon tphcm trung tam ben thanh pho di bo nguyen hue',
  'phường bến thành': 'ben thanh quan 1 cho ben thanh trung tam',
  'phường đa kao': 'da kao dakao q1 quan 1 kenh nhieu loc dinh tien hoang',
  'phường tân định': 'tan dinh nha tho tan dinh quan 1 hai ba trung cho tan dinh',
  'phường phạm ngũ lão': 'pham ngu lao bui vien pho tay bui vien q1 quan 1',
  'phường cầu ông lãnh': 'cau ong lanh q1 quan 1',
  'phường nguyễn thái bình': 'nguyen thai binh pho tai chinh q1 quan 1 bitexco',
  'phường cô giang': 'co giang q1 quan 1',
  'phường cầu kho': 'cau kho q1 quan 1 tran hung dao',
  'phường nguyễn cư trinh': 'nguyen cu trinh q1 quan 1 bo cong an',
  'phường võ thị sáu': 'vo thi sau ho con rua q3 quan 3 bao tang chung tich chien tranh',
  'phường 1 (quận 3)': 'phuong 1 quan 3 q3 ly thai to nguyen thien thuat',
  'phường 2 (quận 3)': 'phuong 2 quan 3 q3 nguyen dinh chieu',
  'phường 4 (quận 3)': 'phuong 4 quan 3 q3 vuon chuoi cach mang thang 8',
  'phường 9 (quận 3)': 'phuong 9 quan 3 q3 ga sai gon',
  'phường 11 (quận 3)': 'phuong 11 quan 3 q3 ky dong',
  'phường thảo điền': 'thao dien q2 quan 2 thu duc tp thu duc quoc te ven song',
  'phường an phú': 'an phu q2 thu duc mega market masteri an phu cantavil',
  'phường an khánh': 'an khanh q2 thu duc',
  'phường bình an': 'binh an q2 thu duc ben thuyen',
  'khu đô thị thủ thiêm': 'thu thiem sala q2 thu duc trung tam tai chinh moi cau ba son',
  'phường hiệp phú': 'hiep phu khu cong nghe cao q9 thu duc shtp le van viet',
  'phường linh trung': 'linh trung lang dai hoc qnu thu duc kcx linh trung',
  'phường linh chiểu': 'linh chieu cho thu duc vo van ngan',
  'phường trường thọ': 'truong tho do thi tuong lai thu duc dang van bi',
  'phường hiệp bình chánh': 'hiep binh chanh gigamall pham van dong thu duc',
  'phường hiệp bình phước': 'hiep binh phuoc van phuc city ql13 thu duc',
  'phường long thạnh mỹ': 'long thanh my vinhomes grand park q9 thu duc',
  'phường long bình': 'long binh ben xe mien dong moi depot metro suoi tien thu duc',
  'phường phước long b': 'phuoc long b do xuan hop thu duc',
  'phường thạnh mỹ lợi': 'thanh my loi ubnd thu duc dong van cong',
  'phường cát lái': 'cat lai cang cat lai thu duc',
  'phường tân phong': 'tan phong phu my hung pmh sc vivocity nguyen van linh quan 7',
  'phường tân phú (quận 7)': 'tan phu quan 7 crescent mall benh vien fv nguyen luong bang',
  'phường tân thuận đông': 'tan thuan dong kcx tan thuan cau phu my quan 7',
  'phường 22 (bình thạnh)': 'phuong 22 binh thanh landmark 81 vinhomes central park',
  'phường 19 (bình thạnh)': 'phuong 19 binh thanh thi nghe thao cam vien',
  'phường 25 (bình thạnh)': 'phuong 25 binh thanh nga tu hang xanh d2 ung van khiem',
  'phường 7 (phú nhuận)': 'phuong 7 phu nhuan phan xich long pho am thuc',
  'phường 1 (phú nhuận)': 'phuong 1 phu nhuan cau kieu hai ba trung',
  'phường 2 (tân bình)': 'phuong 2 tan binh san bay tan son nhat tsn truong son',
  'phường 12 (tân bình)': 'phuong 12 tan binh k300 bau cat truong chinh',
  'phường 1 (gò vấp)': 'phuong 1 go vap pham van dong',
  'phường 10 (gò vấp)': 'phuong 10 go vap cityland nga sau go vap quang trung',
  'phường chợ lớn': 'cho lon pho nguoi hoa quan 5 binh tay hai thuong lan ong',
  'phường 11 (quận 5)': 'phuong 11 quan 5 benh vien cho ray dai hoc y duoc hung vuong',
  'phường 1 (quận 6)': 'phuong 6 quan 6 cho binh tay thap muoi',
  'phường 4 (quận 8)': 'phuong 4 quan 8 cau chanh hung pham the hien',
  'phường 12 (quận 10)': 'phuong 12 quan 10 van hanh mall su van hanh',
  'phường sơn kỳ': 'son ky tan phu aeon mall tan phu celadon',
  'phường an lạc': 'an lac binh tan ben xe mien tay kinh duong vuong',
  'phường bình trị đông': 'binh tri dong binh tan aeon mall binh tan ten lua',
  'phường trung mỹ tây': 'trung my tay quan 12 cong vien phan mem quang trung cvpm',
  'thị trấn cần giờ': 'can gio bien can gio bien 30/4 dao khi',
  'thị trấn củ chi': 'cu chi dia dao cu chi',
  'thị trấn hóc môn': 'hoc mon nga ba giong',
  'thị trấn nhà bè': 'nha be cang hiep phuoc',
  'thị trấn tân túc': 'tan tuc binh chanh',

  // Hà Nội Hubs & Wards
  'phường tràng tiền': 'trang tien hoan kiem nha hat lon ho guom trang tien plaza pho di bo',
  'phường hàng bạc': 'hang bac hoan kiem pho co pho bia ta hien luong ngoc quyen',
  'phường hàng đào': 'hang dao hoan kiem cho dong xuan pho di bo dong kinh nghia thuc',
  'phường quán thánh': 'quan thanh ba dinh ho truc bach den quan thanh thanh nien',
  'phường điện biên': 'dien bien ba dinh quang truong ba dinh lang bac chua mot cot',
  'phường liễu giai': 'lieu giai ba dinh lotte center dao tan van phuc',
  'phường quảng an': 'quang an tay ho ban dao quang an phu tay ho ho tay to ngoc van',
  'phường yên phụ': 'yen phu tay ho de yen phu khach san thang loi',
  'phường dịch vọng hậu': 'dich vong hau cau giay pho duy tan cong nghe ton that thuyet',
  'phường nghĩa tân': 'nghia tan cau giay cong vien nghia do hoang quoc viet',
  'phường bách khoa': 'bach khoa hai ba trung dai hoc bach khoa xay dung ktqd giai phong',
  'phường ô chợ dừa': 'o cho dua dong da ho hoang cau de la thanh xa dan',
  'phường mỹ đình 1': 'my dinh nam tu liem san van dong my dinh svd le duc tho',
  'phường mễ trì': 'me tri nam tu liem keangnam landmark 72 the garden',
  'phường phú la': 'phu la ha dong metro cat linh ha dong kdt van phu',
  'phường bồ đề': 'bo de long bien cau chuong duong cau long bien',

  // Đà Nẵng Wards
  'phường thạch thang': 'thach thang hai chau trung tam hanh chinh da nang cau song han',
  'phường hải châu 1': 'hai chau 1 cau rong bach dang',
  'phường an hải bắc': 'an hai bac son tra bai bien my khe vo nguyen giap',
  'phường phước mỹ': 'phuoc my son tra cong vien bien dong',
  'phường thọ quang': 'tho quang son tra ban dao son tra chua linh ung',
  'phường mỹ an': 'my an ngu hanh son an thuong bien bac my an',
  'phường khuê mỹ': 'khue my ngu hanh son danh thang ngu hanh son non nuoc',

  // Các Phường Trọng Điểm Du Lịch & Đô Thị Khác
  'phường hoàng văn thụ': 'hoang van thu hong bang nha hat lon hai phong',
  'phường đằng lâm': 'dang lam hai an san bay cat bi hai phong',
  'phường vạn hương': 'van huong do son bai bien do son',
  'thị trấn cát bà': 'cat ba vinh lan ha dao cat ba',
  'phường sa pa': 'sa pa sapa nha tho da ho sa pa lao cai',
  'phường phan si păng': 'phan si pang fansipan cap treo sun world sa pa',
  'phường cầu mây': 'cau may ban cat cat muong hoa sa pa',
  'phường phú hội': 'phu hoi pho tay hue song huong',
  'phường thuận hòa': 'thuan hoa dai noi hue kinh thanh hue',
  'phường thủy xuân': 'thuy xuan lang huong lang tu duc hue',
  'phường lộc thọ': 'loc tho tran phu thap tram huong nha trang',
  'phường vĩnh phước': 'vinh phuoc thap ba ponagar hon chong nha trang',
  'phường 1 (đà lạt)': 'phuong 1 da lat ho xuan huong cho dem da lat',
  'phường 10 (đà lạt)': 'phuong 10 da lat ga da lat quang truong lam vien',
  'phường 7 (đà lạt)': 'phuong 7 da lat langbiang thung lung tinh yeu',
  'phường 1 (vũng tàu)': 'phuong 1 vung tau bai truoc',
  'phường 2 (vũng tàu)': 'phuong 2 vung tau bai sau tuong chua kito',
  'phường thắng tam': 'thang tam vung tau cot co bai sau',
  'thị trấn côn đảo': 'con dao nha tu con dao hang duong',
  'phường dương đông': 'duong dong cho dem phu quoc dinh cau',
  'phường an thới': 'an thoi cap treo hon thom phu quoc thi tran hoang hon',
  'xã gành dầu': 'ganh dau vinwonders safari grand world phu quoc',
  'phường tân an (cần thơ)': 'tan an ninh kieu ben ninh kieu can tho',
  'phường cái khế': 'cai khe ninh kieu con cai khe can tho',
  'phường lê bình': 'le binh cai rang cho noi cai rang can tho',
  'phường minh an (hội an)': 'minh an hoi an chua cau pho co hoi an',
  'phường mũi né': 'mui ne phan thiet doi cat bay suoi tien',

  // Miền Bắc
  'hà nội': 'hn thu do ha noi ho guom ba dinh cau giay hoan kiem',
  'hải phòng': 'hp thanh pho hoa phuong do hai phong do son',
  'quảng ninh': 'qn ha long ha long bay cam pha van don bai chay',
  'sa pa': 'sapa fansipan lao cai suong mu',
  'lào cai': 'lao cai cua khau bac ha',
  'ninh bình': 'ninh binh trang an bai dinh tam coc',
  'bắc ninh': 'bac ninh bn kinh bac que vo',
  'hải dương': 'hai duong hd banh dau xanh',
  'hưng yên': 'hung yen pho hien',
  'hà nam': 'ha nam phu ly chua tam chuc',
  'nam định': 'nam dinh nd den tran',
  'thái bình': 'thai binh que lua',
  'vĩnh phúc': 'vinh phuc tam dao dai lai vinh yen',
  'hà giang': 'ha giang cot co lung cu ma pi leng dong van',
  'cao bằng': 'cao bang thac ban gioc pac bo',
  'bắc kạn': 'bac kan ho ba be',
  'lạng sơn': 'lang son ai chi lang dong dang mau son',
  'tuyên quang': 'tuyen quang tan trao',
  'thái nguyên': 'thai nguyen che thai nguyen song cong',
  'phú thọ': 'phu tho den hung viet tri',
  'bắc giang': 'bac giang luc ngan vai thieu',
  'yên bái': 'yen bai mu cang chai thac ba',
  'điện biên': 'dien bien dien bien phu muong thanh',
  'hòa bình': 'hoa binh mai chau thung nai',
  'lai châu': 'lai chau sin ho',
  'sơn la': 'son la moc chau ta xua',

  // Miền Trung & Tây Nguyên
  'đà nẵng': 'dn da nang thanh pho dang song ba na hills cau rong',
  'thừa thiên huế': 'hue co do hue song huong trang tien',
  'đà lạt': 'da lat dalat lam dong thanh pho ngan hoa ho xuan huong',
  'nha trang': 'nha trang khanh hoa vinpearl cam ranh',
  'hội an': 'hoi an quang nam pho co',
  'quy nhơn': 'quy nhon binh dinh ky co eo gio',
  'phan thiết': 'phan thiet binh thuan mui ne cat bay',
  'thanh hóa': 'thanh hoa sam son bim son',
  'nghệ an': 'nghe an vinh cua lo nam dan',
  'hà tĩnh': 'ha tinh thien cam',
  'quảng bình': 'quang binh phong nha ke bang son doong dong hoi',
  'quảng trị': 'quang tri dong ha thanh co',
  'quảng ngãi': 'quang ngai dao ly son dung quat',
  'phú yên': 'phu yen tuy hoa ganh da dia hoa vang co xanh',
  'ninh thuận': 'ninh thuan phan rang vinh hy thap cham',
  'kon tum': 'kon tum mang den nha tho go',
  'gia lai': 'gia lai pleiku bien ho',
  'đắk lắk': 'dak lak daklak buon ma thuot bmt ca phe',
  'đắk nông': 'dak nong ta dung',

  // Miền Nam
  'cần thơ': 'can tho cantho tay do ben ninh kieu cho noi cai rang',
  'bà rịa - vũng tàu': 'vung tau vungtau vt ba ria bai sau bai truoc',
  'bình dương': 'binh duong binhduong thu dau mot tdm di an thuan an',
  'đồng nai': 'dong nai bien hoa bienhoa long thanh',
  'phú quốc': 'phu quoc dao ngoc kien giang vinwonders',
  'kiên giang': 'kien giang rach gia ha tien',
  'tây ninh': 'tay ninh nui ba den toa thanh',
  'bình phước': 'binh phuoc dong xoai',
  'long an': 'long an tan an ben luc',
  'tiền giang': 'tien giang my tho cai be',
  'bến tre': 'ben tre bentre xu dua',
  'trà vinh': 'tra vinh',
  'vĩnh long': 'vinh long',
  'đồng tháp': 'dong thap cao lanh sa dec tram chim',
  'an giang': 'an giang chau doc mieu ba long xuyen',
  'hậu giang': 'hau giang vi thanh',
  'sóc trăng': 'soc trang chua doi',
  'bạc liêu': 'bac lieu cong tu bac lieu dien gio',
  'cà mau': 'ca mau dat mui u minh ha'
};

/**
 * Initialize Fuse.js instance with enhanced typo tolerance & Vietnamese phonetic keys
 */
export function createFuzzySearchEngine(locationsList = []) {
  const preparedData = locationsList.map((item) => {
    const rawName = item.name.toLowerCase();
    const normalizedName = removeVietnameseTones(item.name);
    const aliases = ALIAS_MAP[rawName] || '';
    const adminNorm = removeVietnameseTones(item.admin1 || '');
    const regionNorm = removeVietnameseTones(item.region || '');

    return {
      ...item,
      normalizedName,
      aliases,
      searchIndex: `${normalizedName} ${aliases} ${adminNorm} ${regionNorm}`
    };
  });

  const fuseOptions = {
    includeScore: true,
    threshold: 0.45, // Typo tolerance: handles misspelled letters
    distance: 120,
    minMatchCharLength: 1,
    keys: [
      { name: 'name', weight: 0.35 },
      { name: 'normalizedName', weight: 0.35 },
      { name: 'aliases', weight: 0.2 },
      { name: 'admin1', weight: 0.1 }
    ]
  };

  const fuse = new Fuse(preparedData, fuseOptions);

  return {
    search: (query) => {
      if (!query || query.trim().length === 0) return preparedData;

      const cleanedQuery = removeVietnameseTones(query);
      const results = fuse.search(cleanedQuery);

      return results.map((r) => r.item);
    }
  };
}
