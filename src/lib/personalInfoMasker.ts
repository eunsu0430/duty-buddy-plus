// 개인정보 비식별화 처리 유틸리티

export interface PersonalInfoMaskingOptions {
  maskNames: boolean;
  maskPhoneNumbers: boolean;
  maskAddresses: boolean;
  logDetectedInfo: boolean;
}

interface DetectedInfo {
  names: string[];
  phoneNumbers: string[];
  addresses: string[];
}

export class PersonalInfoMasker {
  private options: PersonalInfoMaskingOptions;

  constructor(options: Partial<PersonalInfoMaskingOptions> = {}) {
    this.options = {
      maskNames: true,
      maskPhoneNumbers: true,
      maskAddresses: true,
      logDetectedInfo: false,
      ...options
    };
  }

  // 개인정보를 탐지하고 비식별화 처리
  maskPersonalInfo(text: string): { maskedText: string; detectedInfo: DetectedInfo } {
    let maskedText = text;
    const detectedInfo: DetectedInfo = {
      names: [],
      phoneNumbers: [],
      addresses: []
    };

    if (this.options.maskPhoneNumbers) {
      const { text: phonesMasked, detected } = this.maskPhoneNumbers(maskedText);
      maskedText = phonesMasked;
      detectedInfo.phoneNumbers = detected;
    }

    if (this.options.maskNames) {
      const { text: namesMasked, detected } = this.maskNames(maskedText);
      maskedText = namesMasked;
      detectedInfo.names = detected;
    }

    if (this.options.maskAddresses) {
      const { text: addressesMasked, detected } = this.maskAddresses(maskedText);
      maskedText = addressesMasked;
      detectedInfo.addresses = detected;
    }

    if (this.options.logDetectedInfo && this.hasDetectedInfo(detectedInfo)) {
      console.log('🔒 개인정보 탐지 및 마스킹 처리:', detectedInfo);
    }

    return { maskedText, detectedInfo };
  }

  // 전화번호 마스킹
  private maskPhoneNumbers(text: string): { text: string; detected: string[] } {
    const detected: string[] = [];
    
    // 다양한 전화번호 패턴
    const phonePatterns = [
      /(\d{2,3})[-\s]?(\d{3,4})[-\s]?(\d{4})/g, // 일반 전화번호
      /010[-\s]?\d{4}[-\s]?\d{4}/g, // 휴대폰
      /(\d{3})[-\s]?(\d{3})[-\s]?(\d{4})/g, // 3-3-4 패턴
      /(\d{4})[-\s]?(\d{4})/g // 4-4 패턴
    ];

    let maskedText = text;

    phonePatterns.forEach(pattern => {
      maskedText = maskedText.replace(pattern, (match) => {
        detected.push(match);
        
        // 전화번호 형태별 마스킹
        if (match.includes('010')) {
          return match.replace(/(\d{3})[-\s]?(\d{2,4})[-\s]?(\d{4})/, '$1-****-****');
        } else if (match.length >= 8) {
          return match.replace(/(\d{2,3})[-\s]?(\d{2,4})[-\s]?(\d{4})/, '$1-***-****');
        } else {
          return '***-****';
        }
      });
    });

    return { text: maskedText, detected: [...new Set(detected)] };
  }

  // 이름 마스킹 (한국어 이름 패턴)
  private maskNames(text: string): { text: string; detected: string[] } {
    const detected: string[] = [];
    let maskedText = text;

    // 한국어 이름 패턴 (2-4글자 한글 + 특정 상황)
    const namePatterns = [
      /[가-힣]{2,4}(?=\s*(?:씨|님|선생|교수|대표|팀장|과장|부장|차장|사장|이사|씨가|님이|님께서|씨는|씨를|씨에게|씨의|님의))/g,
      /(?:신고자|민원인|제보자|신청인|접수자|연락처|성명|이름)[\s:]*([가-힣]{2,4})/g,
      /([가-힣]{2,4})(?=\s*(?:전화|연락|휴대폰|핸드폰))/g
    ];

    namePatterns.forEach(pattern => {
      maskedText = maskedText.replace(pattern, (match, captured) => {
        const name = captured || match;
        if (name.length >= 2 && /^[가-힣]+$/.test(name)) {
          detected.push(name);
          if (name.length === 2) {
            return match.replace(name, name[0] + '*');
          } else if (name.length === 3) {
            return match.replace(name, name[0] + '**');
          } else {
            return match.replace(name, name[0] + '*'.repeat(name.length - 1));
          }
        }
        return match;
      });
    });

    return { text: maskedText, detected: [...new Set(detected)] };
  }

  // 주소 마스킹
  private maskAddresses(text: string): { text: string; detected: string[] } {
    const detected: string[] = [];
    let maskedText = text;

    // 주소 패턴
    const addressPatterns = [
      // 도로명주소
      /([가-힣\s]+(?:시|도))\s*([가-힣\s]+(?:구|군))\s*([가-힣\s]+(?:동|읍|면))\s*([가-힣\s\d-]+(?:로|길))\s*(\d+(?:-\d+)?)/g,
      // 지번주소
      /([가-힣\s]+(?:시|도))\s*([가-힣\s]+(?:구|군))\s*([가-힣\s]+(?:동|읍|면))\s*(\d+(?:-\d+)*번지?)/g,
      // 상세주소 포함
      /([가-힣\s]+(?:시|도))\s*([가-힣\s]+(?:구|군))\s*([가-힣\s]+(?:동|읍|면))\s*([가-힣\s\d-]+)\s*(\d+층|\d+호|아파트|빌라|오피스텔)/g
    ];

    addressPatterns.forEach(pattern => {
      maskedText = maskedText.replace(pattern, (match, ...groups) => {
        detected.push(match);
        
        // 시/도, 구/군, 동/읍/면까지만 유지, 상세주소는 제거
        const [city, district, dong] = groups;
        if (city && district && dong) {
          return `${city.trim()} ${district.trim()} ${dong.trim()} [상세주소 비공개]`;
        }
        return '[주소 비공개]';
      });
    });

    return { text: maskedText, detected: [...new Set(detected)] };
  }

  // 탐지된 정보가 있는지 확인
  hasDetectedInfo(detectedInfo: DetectedInfo): boolean {
    return detectedInfo.names.length > 0 || 
           detectedInfo.phoneNumbers.length > 0 || 
           detectedInfo.addresses.length > 0;
  }

  // 탐지된 개인정보 통계
  getDetectionStats(detectedInfo: DetectedInfo): string {
    const stats = [];
    if (detectedInfo.names.length > 0) stats.push(`이름 ${detectedInfo.names.length}건`);
    if (detectedInfo.phoneNumbers.length > 0) stats.push(`전화번호 ${detectedInfo.phoneNumbers.length}건`);
    if (detectedInfo.addresses.length > 0) stats.push(`주소 ${detectedInfo.addresses.length}건`);
    
    return stats.length > 0 ? `개인정보 ${stats.join(', ')} 마스킹 처리됨` : '개인정보 미탐지';
  }
}