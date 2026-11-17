import UploadForm from "../components/Upload/UploadForm";
import type { UploadProgressInfo } from "../components/Upload/UploadForm";
import type { JobMode, PreprocessStep } from "../interface/Job";

interface UploadPageProps {
  onUpload: (
    input: { file: File; factor: number; mode: JobMode; preprocess: PreprocessStep[] },
    onProgress: (p: UploadProgressInfo) => void,
  ) => Promise<void>;
}

const UploadPage = ({ onUpload }: UploadPageProps) => (
  <div className="mx-auto max-w-2xl pt-6 sm:pt-16">
    <h1 className="mb-8 text-center text-3xl font-semibold tracking-tight">What should we smooth today?</h1>
    <UploadForm onSubmit={onUpload} />
  </div>
);

export default UploadPage;
