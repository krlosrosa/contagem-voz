// Salve como components/SpeechToText.tsx
"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { processTextWithAI } from "@/app/actions/processText";

// --- Constantes e Tipos ---

const isBrowserSupportingSpeechRecognition =
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

type SpeechRecognitionInstance = any;
const SILENCE_TIMEOUT_MS = 5000; // 2 segundos

// NOVO: A frase-gatilho para parar a gravação
const TRIGGER_PHRASE = "confirmar contagem";

interface ItemEstoque {
  codigo_produto: string;
  quantidade_caixas: number | string;
  quantidade_unidades: number | string;
  data_fabricacao: string;
  endereco: string;
}

const estadoInicialForm: ItemEstoque = {
  codigo_produto: "",
  quantidade_caixas: "",
  quantidade_unidades: "",
  data_fabricacao: "",
  endereco: "",
};

// --- Componente Principal ---

export default function SpeechToText() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ItemEstoque>(estadoInicialForm);
  const [itensContados, setItensContados] = useState<ItemEstoque[]>([]);

  const recognitionRef = useRef<SpeechRecognitionInstance>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef("");

  // --- Funções de Reconhecimento de Voz ---

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (recognitionRef.current) {
        console.log("Silêncio detectado, parando automaticamente.");
        recognitionRef.current.stop();
      }
    }, SILENCE_TIMEOUT_MS);
  };

  const startListening = () => {
    if (!isBrowserSupportingSpeechRecognition || isListening || isProcessing) return;

    setTranscript("");
    transcriptRef.current = "";
    setFormData(estadoInicialForm);
    setProcessingError(null);

    const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
      transcriptRef.current = "";
      resetSilenceTimer();
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    recognition.onerror = (event: any) => {
      console.error("Erro no reconhecimento de voz:", event.error);
      setProcessingError(`Erro de Microfone: ${event.error}. Recarregue a página.`);
    };

    // --- PONTO DA MUDANÇA ---
    recognition.onresult = (event: any) => {
      resetSilenceTimer(); // Reseta o timer de silêncio a cada fala

      // 1. Reconstrói a transcrição completa (como antes)
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      const fullTranscript = finalTranscript + interimTranscript;

      // 2. NOVO: Verifica a frase-gatilho (case-insensitive)
      const triggerRegex = new RegExp(TRIGGER_PHRASE, "i"); // "i" = case-insensitive
      
      if (triggerRegex.test(fullTranscript)) {
        console.log("Comando de voz 'confirmar contagem' detectado.");
        
        // 3. Limpa a frase-gatilho do texto que será enviado para a IA
        const cleanedTranscript = fullTranscript.replace(triggerRegex, "").trim();
        
        setTranscript(cleanedTranscript);
        transcriptRef.current = cleanedTranscript;
        
        // 4. Para a gravação
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        return; // Sai do 'onresult'
      }
      
      // 5. Se não achou o gatilho, continua normalmente
      setTranscript(fullTranscript);
      transcriptRef.current = fullTranscript;
    };
    // --- FIM DA MUDANÇA ---

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // --- Funções de Formulário e IA ---

  useEffect(() => {
    if (isListening) return; // Ainda ouvindo

    const finalTranscript = transcriptRef.current.trim();
    if (finalTranscript) {
      // Temos um texto, vamos processar
      const process = async () => {
        setIsProcessing(true);
        setProcessingError(null);

        try {
          const result = await processTextWithAI(finalTranscript);
          setFormData({
            codigo_produto: result.codigo_produto || "",
            quantidade_caixas: result.quantidade_caixas || "",
            quantidade_unidades: result.quantidade_unidades || "",
            data_fabricacao: result.data_fabricacao || "",
            endereco: result.endereco || "",
          });
        } catch (error: any) {
          console.error("Erro na Server Action:", error);
          setProcessingError(error.message || "Falha ao processar o texto.");
        } finally {
          setIsProcessing(false);
        }
      };
      process();
    }
  }, [isListening]); // Gatilho principal da IA

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleConfirm = (e: FormEvent) => {
    e.preventDefault();
    
    // Adiciona o item (editado ou não) ao topo da lista
    setItensContados((prevItens) => [formData, ...prevItens]);

    // Limpa tudo e reinicia
    setFormData(estadoInicialForm);
    setTranscript("");
    transcriptRef.current = "";
    
    // Reinicia o microfone para o próximo registro
    startListening();
  };

  // --- Renderização (JSX) ---
  // (O JSX/HTML abaixo não mudou em nada)

  return (
    <div style={styles.container}>
      {/* --- SEÇÃO DO BOTÃO PRINCIPAL --- */}
      <div style={styles.micButtonContainer}>
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing} // Desabilita enquanto a IA processa
          style={{
            ...styles.micButton,
            ...(isListening ? styles.micButtonListening : {}),
            ...(isProcessing ? styles.micButtonProcessing : {}),
          }}
        >
          {isListening ? "Parar" : "Começar a Falar"}
        </button>
      </div>

      {/* --- SEÇÃO DE STATUS --- */}
      <div style={styles.statusContainer}>
        {isListening && <p style={styles.statusText}>Ouvindo...</p>}
        {isProcessing && <p style={styles.statusText}>Processando com IA...</p>}
        {processingError && <p style={styles.errorText}>{processingError}</p>}
      </div>

      {/* --- SEÇÃO DO FORMULÁRIO (só aparece se tiver dados) --- */}
      {!isProcessing && (formData.codigo_produto || formData.endereco) && ( // Mostra se tiver qualquer dado
        <form onSubmit={handleConfirm} style={styles.form}>
          <h3>Confirmar Registro</h3>
          <div style={styles.inputGroup}>
            <label htmlFor="codigo_produto">Código do Produto</label>
            <input
              type="text"
              id="codigo_produto"
              name="codigo_produto"
              value={formData.codigo_produto}
              onChange={handleFormChange}
              style={styles.input}
            />
          </div>
          <div style={styles.inputRow}>
            <div style={styles.inputGroup}>
              <label htmlFor="quantidade_caixas">Caixas</label>
              <input
                type="number"
                id="quantidade_caixas"
                name="quantidade_caixas"
                value={formData.quantidade_caixas}
                onChange={handleFormChange}
                style={styles.input}
              />
            </div>
            <div style={styles.inputGroup}>
              <label htmlFor="quantidade_unidades">Unidades</label>
              <input
                type="number"
                id="quantidade_unidades"
                name="quantidade_unidades"
                value={formData.quantidade_unidades}
                onChange={handleFormChange}
                style={styles.input}
              />
            </div>
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="endereco">Endereço</label>
            <input
              type="text"
              id="endereco"
              name="endereco"
              value={formData.endereco}
              onChange={handleFormChange}
              style={styles.input}
            />
          </div>
          <div style={styles.inputGroup}>
            <label htmlFor="data_fabricacao">Data Fabricação</label>
            <input
              type="date" 
              id="data_fabricacao"
              name="data_fabricacao"
              value={formData.data_fabricacao}
              onChange={handleFormChange}
              style={styles.input}
            />
          </div>

          <button type="submit" style={styles.confirmButton}>
            Confirmar e Registrar Próximo
          </button>
        </form>
      )}

      {/* --- SEÇÃO DA LISTA DE ITENS CONTADOS --- */}
      {itensContados.length > 0 && (
        <div style={styles.listContainer}>
          <h3>
            Itens Contados ({itensContados.length})
          </h3>
          <ul style={styles.list}>
            {itensContados.map((item, index) => (
              <li key={index} style={styles.listItem}>
                <strong>{item.codigo_produto || "[Sem Código]"}</strong>
                <span style={styles.listItemDetails}>
                  (Cx: {item.quantidade_caixas || 0}, Un: {item.quantidade_unidades || 0})
                </span>
                <span style={styles.listItemLocation}>
                  {item.endereco || "[Sem Endereço]"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// --- Estilos (Mobile-First) ---
// (Os estilos não mudaram)
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  micButtonContainer: {
    textAlign: "center",
  },
  micButton: {
    padding: "15px 25px",
    fontSize: "18px",
    borderRadius: "50px",
    border: "none",
    cursor: "pointer",
    backgroundColor: "#007bff",
    color: "white",
    transition: "background-color 0.2s, transform 0.1s",
  },
  micButtonListening: {
    backgroundColor: "#dc3545",
    transform: "scale(1.05)",
  },
  micButtonProcessing: {
    backgroundColor: "#6c757d",
    cursor: "not-allowed",
  },
  statusContainer: {
    textAlign: "center",
    minHeight: "24px",
  },
  statusText: {
    fontSize: "16px",
    color: "#333",
  },
  errorText: {
    color: "red",
    fontWeight: "bold",
  },
  form: {
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    backgroundColor: "#f9f9f9",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  inputRow: {
    display: "flex",
    gap: "10px",
    width: "100%",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    flex: 1, 
  },
  input: {
    padding: "10px",
    fontSize: "16px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    width: "100%", 
    boxSizing: "border-box", 
  },
  confirmButton: {
    padding: "12px",
    fontSize: "16px",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  listContainer: {
    marginTop: "20px",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  listItem: {
    padding: "10px",
    backgroundColor: "#f0f0f0",
    borderRadius: "4px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap", 
    gap: "5px",
  },
  listItemDetails: {
    color: "#555",
  },
  listItemLocation: {
    color: "#0056b3",
    fontStyle: "italic",
    flexBasis: "100%", 
    textAlign: "right",
  },
};