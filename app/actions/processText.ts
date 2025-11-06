// Salve como app/actions/processText.ts
"use server";

import OpenAI from "openai";
import { headers } from "next/headers";

// 1. Inicializa o cliente da OpenAI (lendo do .env.local)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. O PROMPT (Regras de Produto Apenas Numérico)
const getStockCountPrompt = (currentDate: string) => `
Você é um assistente de IA especialista em extrair dados de contagem de estoque (inventário) a partir de um texto falado.
Sua tarefa é converter o texto do usuário em um JSON.

O formato JSON desejado é:
{
  "codigo_produto": "string" | null,
  "quantidade_caixas": number | null,
  "quantidade_unidades": number | null,
  "data_fabricacao": "YYYY-MM-DD" | null,
  "endereco": "string" | null 
}

Regras:
1. Analise o texto do usuário para identificar os cinco campos.
2. NOVO: O "codigo_produto" é SEMPRE um código numérico. O formato de saída DEVE ser uma string de 9 dígitos numéricos (ex: "610116340").
3. NOVO: Se o usuário falar um código numérico com menos de 9 dígitos (ex: '10025'), você DEVE preencher com zeros à esquerda para totalizar 9 dígitos (ex: '000010025').
4. NOVO: Se o usuário falar um código misturado com letras (ex: 'Produto 998-B' ou 'AF1000'), ignore as letras, extraia APENAS os números e preencha com zeros à esquerda (ex: '998-B' -> '000000998', 'AF1000' -> '000001000').
5. Se nenhum número for falado para o código, use null.
6. "quantidade_caixas" pode ser 'caixas', 'cxs', etc.
7. "quantidade_unidades" pode ser 'unidades', 'un', 'peças', 'soltas'.
8. A data de fabricação DEVE ser formatada como YYYY-MM-DD. A data atual é ${currentDate}.
9. O "endereco" DEVE ser formatado como "L NNN NNNN". Preencha com zeros à esquerda (ex: "A 1 10" -> "A 001 0010").
10. Retorne APENAS o objeto JSON, sem nenhum texto extra, markdown ou explicação.

Exemplos (Data atual: ${currentDate}):

Texto: "Anotado. 10 caixas e 5 unidades soltas do código 10025. Fabricação de 30 de outubro. Endereço A 1 5."
JSON: { "codigo_produto": "000010025", "quantidade_caixas": 10, "quantidade_unidades": 5, "data_fabricacao": "2025-10-30", "endereco": "A 001 0005" }

Texto: "Ok, 50 caixas do produto 998-B. Fabricado hoje."
JSON: { "codigo_produto": "000000998", "quantidade_caixas": 50, "quantidade_unidades": null, "data_fabricacao": "${currentDate}", "endereco": null }

Texto: "Contando... 15 unidades do 77441, na rua 5 posição 20."
JSON: { "codigo_produto": "000077441", "quantidade_caixas": null, "quantidade_unidades": 15, "data_fabricacao": null, "endereco": "A 005 0020" }

Texto: "No endereço B 15 30 10, encontrei 50 caixas e 10 soltas do 99401."
JSON: { "codigo_produto": "000099401", "quantidade_caixas": 50, "quantidade_unidades": 10, "data_fabricacao": null, "endereco": "B 015 3010" }

Texto: "Produto AF1000, 200 caixas."
JSON: { "codigo_produto": "000001000", "quantidade_caixas": 200, "quantidade_unidades": null, "data_fabricacao": null, "endereco": null }

Texto: "Contagem do 610116340. 30 caixas. Endereço C 40 1001."
JSON: { "codigo_produto": "610116340", "quantidade_caixas": 30, "quantidade_unidades": null, "data_fabricacao": null, "endereco": "C 040 1001" }
`;

/**
 * Nossa Server Action
 * @param text O texto transcrito vindo do cliente
 * @returns Um objeto JSON de contagem de estoque
 */
export async function processTextWithAI(text: string): Promise<any> {
  if (!text.trim()) {
    throw new Error("Texto de entrada está vazio.");
  }

  try {
    // Pega a data atual do servidor para referência
    headers(); 
    const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    const systemPrompt = getStockCountPrompt(today);

    console.log("Enviando para a OpenAI (Estoque Apenas Numérico):", text);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.1, // Temperatura baixa para seguir as regras à risca
    });

    const jsonString = completion.choices[0].message.content;
    console.log("Resposta da OpenAI (bruta):", jsonString);

    if (!jsonString) {
      throw new Error("A IA não retornou conteúdo.");
    }

    return JSON.parse(jsonString);

  } catch (e: any) {
    console.error("Erro ao processar com OpenAI:", e);
    const errorMessage = e.response?.data?.error?.message || e.message || "Erro desconhecido";
    throw new Error(`Falha na IA (OpenAI): ${errorMessage}`);
  }
}