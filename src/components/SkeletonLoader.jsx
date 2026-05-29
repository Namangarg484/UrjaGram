function SkeletonLoader({ lines = 4, className = '' }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-4 rounded-full bg-slate-200" />
      ))}
    </div>
  );
}

export default SkeletonLoader;