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
  'phường bến nghé': 'ben nghe q1 quan 1 saigon sai gon tphcm trung tam ben thanh',
  'phường bến thành': 'ben thanh quan 1 cho ben thanh',
  'phường thảo điền': 'thao dien q2 quan 2 thu duc tp thu duc',
  'phường an phú': 'an phu q2 thu duc',
  'phường hiệp phú': 'hiep phu khu cong nghe cao q9 thu duc',
  'khu đô thị thủ thiêm': 'thu thiem sala q2 thu duc',
  'phường tân định': 'tan dinh nha tho tan dinh quan 1',
  'phường chợ lớn': 'cho lon pho nguoi hoa quan 5 binh tay',
  'phường phú mỹ hưng': 'phu my hung pmh quan 7 nam sai gon',
  'thị trấn cần giờ': 'can gio bien can gio bien 30/4',

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
