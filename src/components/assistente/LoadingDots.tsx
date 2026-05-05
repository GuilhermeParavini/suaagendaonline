function LoadingDots() {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-1">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full bg-teal-400 animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full bg-teal-400 animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full bg-teal-400 animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <p className="text-xs text-gray-400">Consultando dados...</p>
    </div>
  );
}

export default LoadingDots;
