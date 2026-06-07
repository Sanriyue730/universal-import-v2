'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, FileText, File } from 'lucide-react'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  isProcessing?: boolean
}

const ACCEPT_TYPES = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/pdf': ['.pdf'],
}

function getFileIcon(name: string) {
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return FileSpreadsheet
  if (name.endsWith('.docx')) return FileText
  if (name.endsWith('.pdf')) return File
  return File
}

export function FileUpload({ onFileSelect, isProcessing }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0]
      setSelectedFile(file)
      onFileSelect(file)
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT_TYPES,
    multiple: false,
    disabled: isProcessing,
  })

  const Icon = selectedFile ? getFileIcon(selectedFile.name) : Upload

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        isDragActive
          ? 'border-[var(--primary)] bg-[var(--primary-light)]'
          : selectedFile
          ? 'border-[var(--primary-border)] bg-[var(--primary-light)]'
          : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)]'
      } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input {...getInputProps()} />
      <Icon className={`w-12 h-12 mx-auto mb-4 ${
        selectedFile ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
      }`} />
      {selectedFile ? (
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{selectedFile.name}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {(selectedFile.size / 1024).toFixed(1)} KB · 点击或拖拽更换文件
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {isDragActive ? '释放文件以上传' : '拖拽文件到此处，或点击选择文件'}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            支持 Excel (.xlsx/.xls)、Word (.docx)、PDF 格式
          </p>
        </div>
      )}
    </div>
  )
}
