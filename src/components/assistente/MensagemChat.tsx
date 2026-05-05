import { cn } from "@/lib/utils";

interface MensagemChatProps {
  tipo: "usuario" | "assistente";
  texto: string;
  timestamp?: Date;
}

function formatarHora(d: Date): string {
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MensagemChat({ tipo, texto, timestamp }: MensagemChatProps) {
  const ehUsuario = tipo === "usuario";
  return (
    <div
      className={cn(
        "flex flex-col",
        ehUsuario ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
          ehUsuario
            ? "bg-teal-600 text-white rounded-tr-sm"
            : "bg-gray-100 text-gray-800 rounded-tl-sm",
        )}
      >
        {texto}
      </div>
      {timestamp ? (
        <span
          className={cn(
            "mt-1 text-xs text-gray-400",
            ehUsuario ? "text-right" : "text-left",
          )}
        >
          {formatarHora(timestamp)}
        </span>
      ) : null}
    </div>
  );
}

export default MensagemChat;
