/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, CheckCircle2, ChevronRight, AlertCircle, ChevronDown } from 'lucide-react';
import gsap from 'gsap';
import { submitEntry } from './lib/appwrite';

const SCHOOL_OPTIONS = [
  { label: '上海震旦职业学院', value: '上海震旦职业学院' },
  { label: '上海外国语大学贤达经济人文学院', value: '上海外国语大学贤达经济人文学院' },
  { label: '上海建桥学院', value: '上海建桥学院' },
  { label: '上海师范大学天华学院', value: '上海师范大学天华学院' },
];

const FILE_RULES: Record<string, { accept: string; label: string }> = {
  postcard: {
    accept: '.jpg,.jpeg,.png,image/jpeg,image/png',
    label: '支持 JPG、PNG 图片文件',
  },
  presentation: {
    accept: '.ppt,.pptx,.pdf,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    label: '支持 PPT、PPTX、PDF 文档文件',
  },
  video: {
    accept: '',
    label: '请粘贴网盘链接（百度云/夸克等）',
  },
};

type CategoryKey = 'postcard' | 'presentation' | 'video';

type FormState = {
  name: string;
  phone: string;
  school: string;
  studentId: string;
  category: CategoryKey;
  videoUrl?: string;
};

type UploadStage = 'uploading' | 'saving';

function isLikelyCloudDriveContent(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return false;
  }

  const cloudDriveHints = [
    'http://',
    'https://',
    'pan.baidu.com',
    '百度网盘',
    '夸克网盘',
    'pan.quark.cn',
    'aliyundrive.com',
    '提取码',
    '分享',
  ];

  return cloudDriveHints.some((hint) => value.includes(hint));
}

const FloatingCard = ({ children, className, style, delay = 0 }: any) => {
  const floatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(floatRef.current, {
        y: -20,
        rotation: style.rotate + 5,
        duration: 3,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        delay: delay,
      });
    });
    return () => ctx.revert();
  }, [style.rotate, delay]);

  return (
    <div className={`absolute z-0 hover:z-50 pointer-events-auto ${className}`}>
      <div ref={floatRef} className="w-full h-full" style={{ transform: `rotate(${style.rotate}deg)` }}>
        <motion.div
          className="w-full h-full rounded-2xl shadow-xl border border-zinc-100/50 bg-white/80 backdrop-blur-sm p-2 cursor-pointer group"
          whileHover={{
            scale: 1.15,
            boxShadow: "0 25px 50px -12px rgba(249, 115, 22, 0.3)",
            borderColor: "rgba(249, 115, 22, 0.5)",
            transition: { type: "spring", stiffness: 300, damping: 15 }
          }}
          whileTap={{ 
            scale: 0.9, 
            transition: { type: "spring", stiffness: 300, damping: 15 } 
          }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
};

const FloatingCards = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Top Left */}
      <FloatingCard className="w-32 h-24 md:w-48 md:h-32 left-[-2%] md:left-[4%] top-[5%] md:top-[8%]" style={{ rotate: -12 }} delay={0}>
        <div className="w-full h-full bg-white rounded-xl border border-zinc-100 flex items-center justify-center shadow-sm overflow-hidden">
          <svg viewBox="0 0 100 60" className="w-2/3 h-2/3 text-orange-500 group-hover:scale-125 transition-transform duration-500 ease-out">
            <ellipse cx="50" cy="30" rx="40" ry="20" fill="none" stroke="currentColor" strokeWidth="4"/>
            <circle cx="50" cy="30" r="12" fill="currentColor"/>
          </svg>
        </div>
      </FloatingCard>

      {/* Top Right */}
      <FloatingCard className="w-28 h-20 md:w-40 md:h-28 right-[-2%] md:right-[4%] top-[8%] md:top-[12%]" style={{ rotate: 15 }} delay={1}>
        <div className="w-full h-full bg-zinc-900 rounded-xl flex items-center justify-center shadow-md overflow-hidden">
          <svg viewBox="0 0 100 60" className="w-2/3 h-2/3 group-hover:-translate-y-2 group-hover:scale-110 transition-transform duration-500 ease-out">
            <path d="M10,30 Q30,10 50,30 T90,30" fill="none" stroke="#f97316" strokeWidth="4"/>
            <circle cx="10" cy="30" r="6" fill="#f97316"/>
            <circle cx="50" cy="30" r="6" fill="#f97316"/>
            <circle cx="90" cy="30" r="6" fill="#f97316"/>
          </svg>
        </div>
      </FloatingCard>

      {/* Bottom Left */}
      <FloatingCard className="w-36 h-24 md:w-52 md:h-36 left-[2%] md:left-[6%] bottom-[10%] md:bottom-[12%]" style={{ rotate: 8 }} delay={0.5}>
        <div className="w-full h-full bg-white rounded-xl border border-zinc-100 flex items-center justify-center shadow-sm overflow-hidden relative">
           <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out"></div>
           <div className="absolute -right-4 -top-4 w-20 h-20 bg-zinc-50 rounded-full group-hover:scale-150 transition-transform duration-700 ease-out delay-75"></div>
           <div className="w-16 h-16 bg-zinc-900 rounded-full z-10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-180 transition-all duration-500 ease-out">
              <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
           </div>
        </div>
      </FloatingCard>

      {/* Bottom Right */}
      <FloatingCard className="w-32 h-24 md:w-48 md:h-32 right-[2%] md:right-[5%] bottom-[5%] md:bottom-[10%]" style={{ rotate: -6 }} delay={1.5}>
        <div className="w-full h-full bg-orange-500 rounded-xl flex items-center justify-center shadow-md overflow-hidden">
           <svg viewBox="0 0 100 100" className="w-1/2 h-1/2 text-white group-hover:rotate-[120deg] group-hover:scale-110 transition-all duration-700 ease-out">
              <polygon points="50,10 90,90 10,90" fill="currentColor"/>
              <circle cx="50" cy="65" r="12" fill="#f97316"/>
           </svg>
        </div>
      </FloatingCard>
      
      {/* Center Left (small) */}
      <FloatingCard className="w-20 h-20 md:w-28 md:h-28 left-[-5%] md:left-[2%] top-[45%] hidden sm:block" style={{ rotate: -25 }} delay={2}>
        <div className="w-full h-full bg-white rounded-xl border border-zinc-100 flex items-center justify-center shadow-sm overflow-hidden">
           <div className="w-10 h-10 border-4 border-zinc-900 rounded-sm rotate-12 group-hover:rotate-[135deg] group-hover:scale-125 group-hover:border-orange-500 transition-all duration-500 ease-out"></div>
        </div>
      </FloatingCard>

      {/* Center Right (small) */}
      <FloatingCard className="w-24 h-16 md:w-36 md:h-24 right-[-5%] md:right-[2%] top-[50%] hidden sm:block" style={{ rotate: 20 }} delay={0.8}>
        <div className="w-full h-full bg-white rounded-xl border border-zinc-100 flex items-center justify-center shadow-sm overflow-hidden">
           <div className="w-full h-3 bg-zinc-100 mx-6 rounded-full relative overflow-hidden group-hover:h-6 transition-all duration-300 ease-out">
              <motion.div 
                className="absolute left-0 top-0 h-full bg-orange-500 rounded-full"
                animate={{ width: ['20%', '80%', '20%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
           </div>
        </div>
      </FloatingCard>
    </div>
  );
};

function SubmitModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [filesByCategory, setFilesByCategory] = useState<Record<CategoryKey, File | null>>({
    postcard: null,
    presentation: null,
    video: null,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<UploadStage>('uploading');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<FormState>({
    name: '',
    phone: '',
    school: '',
    studentId: '',
    category: 'postcard',
    videoUrl: '',
  });

  useEffect(() => {
    if (!loading || step !== 2) {
      return;
    }

    const progressCap = uploadStage === 'uploading' ? 88 : 96;
    const timer = window.setInterval(() => {
      setUploadProgress((current) => {
        if (current >= progressCap) {
          return current;
        }

        if (current < 20) {
          return Math.min(current + 4, progressCap);
        }

        if (current < 60) {
          return Math.min(current + 2, progressCap);
        }

        return Math.min(current + 1, progressCap);
      });
    }, 180);

    return () => {
      window.clearInterval(timer);
    };
  }, [loading, step, uploadStage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nextValue =
      name === 'phone' ? value.replace(/\D/g, '').slice(0, 11) : value;
    setFormData(prev => ({ ...prev, [name]: nextValue }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextCategory = e.target.value as CategoryKey;
    setFormData(prev => ({ 
      ...prev, 
      category: nextCategory,
      // Clear videoUrl when switching away from video category
      videoUrl: nextCategory === 'video' ? prev.videoUrl : '',
    }));
    setFile(filesByCategory[nextCategory]);
    setError(null);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const currentFileRule = FILE_RULES[formData.category] ?? FILE_RULES.postcard;

  const isFileAccepted = (selectedFile: File) => {
    const acceptedItems = currentFileRule.accept
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const fileName = selectedFile.name.toLowerCase();
    const fileType = selectedFile.type.toLowerCase();

    return acceptedItems.some((item) => {
      if (item.startsWith('.')) {
        return fileName.endsWith(item);
      }
      return fileType === item;
    });
  };

  const assignFile = (selectedFile: File | null) => {
    if (!selectedFile) {
      return;
    }

    if (!isFileAccepted(selectedFile)) {
      setFile(null);
      setFilesByCategory((prev) => ({ ...prev, [formData.category]: null }));
      setError(`当前类别文件格式不正确，${currentFileRule.label}`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setError(null);
    setFile(selectedFile);
    setFilesByCategory((prev) => ({ ...prev, [formData.category]: selectedFile }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    assignFile(e.target.files?.[0] || null);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    assignFile(e.dataTransfer.files?.[0] || null);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.phone || !formData.school || !formData.studentId) {
      setError('请填写所有必需的字段');
      return;
    }

    if (!/^\d{11}$/.test(formData.phone.trim())) {
      setError('请输入11位手机号');
      return;
    }

    if (formData.category === 'video') {
      if (!formData.videoUrl || formData.videoUrl.trim() === '') {
        setError('请粘贴网盘链接');
        return;
      }

      if (!isLikelyCloudDriveContent(formData.videoUrl)) {
        setError('当前为“项目视频”模式，仅支持网盘分享内容。若要上传图片/PPT，请切换上方参赛类别。');
        return;
      }

      console.log('[Submit] Video category - videoUrl:', formData.videoUrl);
    } else {
      if (!file) {
        setError('请选择文件');
        return;
      }
      console.log('[Submit] File category:', formData.category, '- fileName:', file.name);
    }

    console.log('[Submit] Submitting with formData:', formData);

    setError(null);
    setLoading(true);
    setUploadStage('uploading');
    setUploadProgress(6);
    setStep(2);

    try {
      await submitEntry({
        name: formData.name,
        phone: formData.phone,
        school: formData.school,
        studentId: formData.studentId,
        category: formData.category,
        file: formData.category === 'video' ? null : file,
        videoUrl: formData.category === 'video' ? formData.videoUrl?.trim() : undefined,
        onProgress: (progress) => {
          setUploadProgress((current) => Math.max(current, Math.round(progress)));
        },
        onStageChange: (nextStage) => {
          setUploadStage(nextStage);
        },
      });

      setUploadProgress(100);
      setStep(3);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setUploadProgress(0);
      setUploadStage('uploading');
      setStep(1);
      setError(err instanceof Error ? err.message : '提交失败，请重试');
      console.error('Submit error:', err);
    }
  };

  const progressLabel = `${Math.round(uploadProgress)}%`;
  const progressTitle = uploadStage === 'uploading' ? '正在上传作品' : '正在保存报名信息';
  const progressDescription =
    uploadStage === 'uploading'
      ? '文件上传中，请稍候...'
      : '文件已上传，正在写入报名信息...';
  const progressHint =
    uploadStage === 'uploading'
      ? '上传完成后会自动进入报名信息保存阶段'
      : '信息保存完成后会自动显示提交成功弹窗';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-zinc-100">
          <h3 className="text-xl font-bold text-zinc-900">提交参赛作品</h3>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </motion.div>
          )}
          
          {step === 1 && (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">姓名</label>
                  <input 
                    required 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" 
                    placeholder="请输入真实姓名" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">联系电话</label>
                  <input 
                    required 
                    type="tel" 
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    inputMode="numeric"
                    pattern="[0-9]{11}"
                    maxLength={11}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" 
                    placeholder="请输入11位手机号码" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">所在学校</label>
                  <div className="relative">
                    <select
                      required
                      name="school"
                      value={formData.school}
                      onChange={handleSelectChange}
                      className="w-full appearance-none px-4 py-3 pr-12 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white text-zinc-900"
                    >
                      <option value="" disabled>请选择所在学校</option>
                      {SCHOOL_OPTIONS.map((school) => (
                        <option key={school.label} value={school.value}>
                          {school.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">学号</label>
                  <input 
                    required 
                    type="text" 
                    name="studentId"
                    value={formData.studentId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white" 
                    placeholder="请输入学号" 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-900">参赛类别</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="relative flex cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:ring-1 has-[:checked]:ring-orange-500 has-[:checked]:bg-orange-50/50">
                    <input 
                      type="radio" 
                      name="category" 
                      value="postcard" 
                      checked={formData.category === 'postcard'}
                      onChange={handleCategoryChange}
                      className="sr-only" 
                    />
                    <span className="flex flex-col">
                      <span className="block text-sm font-bold text-zinc-900">明信片设计</span>
                      <span className="mt-1 flex items-center text-xs text-zinc-500">图片格式 (JPG/PNG)</span>
                    </span>
                  </label>
                  <label className="relative flex cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:ring-1 has-[:checked]:ring-orange-500 has-[:checked]:bg-orange-50/50">
                    <input 
                      type="radio" 
                      name="category" 
                      value="presentation" 
                      checked={formData.category === 'presentation'}
                      onChange={handleCategoryChange}
                      className="sr-only" 
                    />
                    <span className="flex flex-col">
                      <span className="block text-sm font-bold text-zinc-900">演示文稿演讲</span>
                      <span className="mt-1 flex items-center text-xs text-zinc-500">文档格式 (PPT/PDF)</span>
                    </span>
                  </label>
                  <label className="relative flex cursor-pointer rounded-xl border border-zinc-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-orange-500 hover:border-orange-300 transition-colors has-[:checked]:border-orange-500 has-[:checked]:ring-1 has-[:checked]:ring-orange-500 has-[:checked]:bg-orange-50/50">
                    <input 
                      type="radio" 
                      name="category" 
                      value="video" 
                      checked={formData.category === 'video'}
                      onChange={handleCategoryChange}
                      className="sr-only" 
                    />
                    <span className="flex flex-col">
                      <span className="block text-sm font-bold text-zinc-900">项目视频</span>
                      <span className="mt-1 flex items-center text-xs text-zinc-500">网盘链接 (百度云/夸克)</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-900">作品上传</label>
                
                {formData.category === 'video' ? (
                  // Video category: link input
                  <div className="space-y-2">
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700">
                      <p className="font-medium mb-2">网盘链接上传</p>
                      <p className="text-xs">支持百度云盘、夸克网盘等。请设置文件提取有效期为 <strong>永久</strong>，否则组委会可能无法下载。</p>
                      <p className="text-xs mt-2 text-blue-600">此模式只保存网盘分享内容，不会上传文件到存储桶。</p>
                    </div>
                    <input
                      type="text"
                      name="videoUrl"
                      value={formData.videoUrl || ''}
                      onChange={handleInputChange}
                      placeholder="请粘贴网盘分享内容（支持链接、提取码或整段文案）"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-zinc-50 focus:bg-white"
                    />
                    {formData.videoUrl && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>链接已粘贴</span>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  // Postcard & Presentation: file upload
                  <div
                    onClick={openFilePicker}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDragging(false);
                    }}
                    onDrop={handleDrop}
                    className={`mt-2 flex w-full justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-all relative group bg-zinc-50/50 text-left cursor-pointer ${
                      isDragging
                        ? 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-100'
                        : 'border-zinc-200 hover:border-orange-400 hover:bg-orange-50/30'
                    }`}
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 mb-4 mx-auto bg-white rounded-full shadow-sm flex items-center justify-center border border-zinc-100 group-hover:scale-110 transition-transform">
                        <Upload className="h-8 w-8 text-zinc-400 group-hover:text-orange-500 transition-colors" aria-hidden="true" />
                      </div>
                      <div className="flex text-sm leading-6 text-zinc-600 justify-center">
                        <span className="rounded-md font-bold text-orange-600">
                          点击选择文件
                        </span>
                        <p className="pl-1">或拖拽至此区域</p>
                      </div>
                      <p className="text-xs leading-5 text-zinc-400 mt-2">{currentFileRule.label}</p>
                      <input
                        ref={fileInputRef}
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        required
                        accept={currentFileRule.accept}
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                      {file && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 inline-flex items-center px-4 py-2 rounded-full bg-white border border-orange-200 text-orange-700 text-sm font-medium shadow-sm"
                        >
                          <span className="truncate max-w-[200px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setFile(null);
                              setFilesByCategory((prev) => ({ ...prev, [formData.category]: null }));
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="ml-2 text-orange-400 hover:text-orange-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-zinc-100 flex justify-end gap-4">
                <button 
                  type="button" 
                  onClick={onClose} 
                  disabled={loading}
                  className="px-6 py-3 text-sm font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-8 py-3 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-lg shadow-orange-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {loading ? '上传中...' : '确认提交'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="py-32 flex flex-col items-center justify-center space-y-6">
              <div className="w-full max-w-md space-y-4">
                <div className="flex items-center justify-between text-sm font-semibold text-zinc-600">
                  <span>{progressTitle}</span>
                  <span>{progressLabel}</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-orange-100">
                  <motion.div
                    className="h-full rounded-full bg-orange-500"
                    animate={{ width: `${Math.max(uploadProgress, 6)}%` }}
                    transition={{ ease: 'easeOut', duration: 0.2 }}
                  />
                </div>
                <p className="text-center text-lg font-bold text-zinc-700">
                  {progressDescription}
                </p>
                <p className="text-center text-sm text-zinc-500">
                  {progressHint}
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-24 flex flex-col items-center justify-center space-y-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
              >
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
              </motion.div>
              <div className="space-y-3">
                <h4 className="text-3xl font-black text-zinc-900">提交成功！</h4>
                <p className="text-zinc-500 max-w-sm mx-auto">您的作品已成功上传至大赛组委会，请保持通讯畅通，祝您取得好成绩。</p>
              </div>
              <button onClick={onClose} className="mt-8 px-10 py-4 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all hover:-translate-y-0.5 shadow-xl shadow-zinc-900/20">
                返回首页
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 overflow-hidden relative font-sans selection:bg-orange-200 flex flex-col">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 md:p-10">
        <div className="text-sm md:text-base font-bold tracking-tight text-zinc-800 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          上海市民办高校新联会
        </div>
        <div className="text-sm md:text-base font-bold tracking-tight text-zinc-400">
          2026
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10 md:py-0">
        
        <FloatingCards />

        {/* Center Text */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center z-20 max-w-4xl mx-auto w-full relative"
        >
          {/* Protective glow to ensure text readability against floating cards */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[160%] bg-white/90 blur-3xl rounded-full pointer-events-none -z-10"></div>

          <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-zinc-200 bg-white/50 backdrop-blur-sm text-sm font-bold text-zinc-500 tracking-widest uppercase shadow-sm">
            第三届大学生
          </div>
          
          <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[9rem] font-black tracking-tight mb-6 text-zinc-900 flex flex-row items-center justify-center gap-4 sm:gap-8 drop-shadow-sm flex-wrap">
            <span>设计</span>
            <span className="text-orange-500 font-serif italic font-light text-5xl sm:text-7xl md:text-8xl lg:text-[8rem]">&</span>
            <span>演讲</span>
          </h1>
          
          <p className="text-lg sm:text-xl md:text-3xl font-medium text-zinc-500 mb-12 tracking-wide">
            明信片设计及演示文稿演讲大赛
          </p>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className="group relative inline-flex items-center justify-center px-10 py-5 text-lg md:text-xl font-black text-white transition-all duration-300 bg-orange-600 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-600 hover:bg-orange-700 shadow-2xl shadow-orange-600/30 overflow-hidden"
          >
            <span className="relative z-10 flex items-center">
              作品申报入口
              <ChevronRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
          </motion.button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 flex flex-col md:flex-row justify-between items-center md:items-end p-6 md:p-10 mt-auto text-xs md:text-sm text-zinc-400 gap-6 text-center md:text-left bg-gradient-to-t from-white/80 to-transparent pt-20">
        <div className="max-w-2xl space-y-2">
          <p className="font-bold text-zinc-800 text-sm md:text-base mb-2">组织架构</p>
          <p><span className="font-semibold text-zinc-500">主办单位：</span>上海市民办高校新的社会阶层人士联谊会</p>
          <p><span className="font-semibold text-zinc-500">承办单位：</span>上海震旦职业学院、上海外国语大学贤达经济人文学院、上海建桥学院、上海师范大学天华学院</p>
        </div>
        <div className="md:text-right space-y-2">
          <p className="font-bold text-zinc-800 text-sm md:text-base mb-2">活动时间</p>
          <p className="font-mono text-zinc-500 bg-zinc-100 px-3 py-1 rounded-md inline-block">2026.4.20 - 2026.5.15</p>
        </div>
      </footer>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <SubmitModal onClose={() => setIsModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
