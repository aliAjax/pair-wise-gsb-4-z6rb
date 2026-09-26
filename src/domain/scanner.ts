// 扫描证据层：模拟对依赖产物的独立扫描（LICENSE 文件、源码头声明、包元数据）。
// 与清单声明分离：声明可能与实际证据不一致，以扫描证据驱动判断。

import type { Channel, DependencyItem, ScanEvidence } from './types';

interface EvidenceFixture {
  detectedLicense: string;
  source: string;
  confidence: 'high' | 'low';
}

// 按 名称@版本 登记的已知扫描结果（模拟制品扫描服务的返回）
const REGISTRY: Record<string, EvidenceFixture> = {
  'react@18.3.1': { detectedLicense: 'MIT', source: 'LICENSE 文件与 package.json 元数据一致', confidence: 'high' },
  'lodash@4.17.21': { detectedLicense: 'MIT', source: 'LICENSE 文件与源码头声明一致', confidence: 'high' },
  'axios@1.7.2': { detectedLicense: 'MIT', source: 'LICENSE 文件与 package.json 元数据一致', confidence: 'high' },
  'zod@3.23.8': { detectedLicense: 'MIT', source: 'LICENSE 文件与 package.json 元数据一致', confidence: 'high' },
  'sharp@0.33.4': { detectedLicense: 'Apache-2.0', source: 'LICENSE 文件、NOTICE 与元数据一致', confidence: 'high' },
  'font-awesome@6.5.2': { detectedLicense: 'CC-BY-4.0', source: '官方发布包内 LICENSE 文本（署名许可，非典型代码许可）', confidence: 'high' },
  'legacy-gpl@2.4.0': { detectedLicense: 'GPL-3.0', source: '源码目录中存在 GPL-3.0 许可证全文及 copyleft 头声明', confidence: 'high' },
  'some-proprietary@1.0.0': { detectedLicense: 'Proprietary', source: '商业 EULA 文本，未发现开源授权条款', confidence: 'high' },
  'ui-kit@3.0.0': { detectedLicense: 'BSD-3-Clause', source: '组件源码头声明为 BSD-3-Clause，与包元数据不符', confidence: 'high' },
  'libfoo@2.0.0': { detectedLicense: 'MIT', source: 'LICENSE 文件与 npm 包元数据一致', confidence: 'high' },
};

// 渠道特有的扫描证据：同一包换渠道，证据可能完全不同（重新打包/夹带）
const CHANNEL_OVERRIDES: Record<string, Partial<Record<Channel, EvidenceFixture>>> = {
  'libfoo@2.0.0': {
    vendor: { detectedLicense: 'GPL-3.0', source: '供应商重新打包的制品中检出 GPL-3.0 源码目录，与 npm 原版不一致', confidence: 'high' },
  },
};

export function scanItem(item: DependencyItem): ScanEvidence {
  const nameVersion = `${item.name}@${item.version}`;
  const override = CHANNEL_OVERRIDES[nameVersion]?.[item.channel];
  if (override) return { ...override };

  const known = REGISTRY[nameVersion];
  if (known) return { ...known };

  // 未登记的包：依据声明做弱证据扫描；未声明则无法识别
  if (item.declaredLicense) {
    return {
      detectedLicense: item.declaredLicense,
      source: '未命中扫描知识库，仅回退采用清单声明（低置信度）',
      confidence: 'low',
    };
  }
  return {
    detectedLicense: 'UNKNOWN',
    source: '制品中未找到可识别的 LICENSE 文件或许可证头声明',
    confidence: 'low',
  };
}
