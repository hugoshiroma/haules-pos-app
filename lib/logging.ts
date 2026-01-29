import * as FileSystem from 'expo-file-system/legacy';

const LOG_FILE = `${FileSystem.documentDirectory}app.log`;

// Função para garantir que o arquivo de log existe
const ensureLogFileExists = async () => {
  const fileInfo = await FileSystem.getInfoAsync(LOG_FILE);
  if (!fileInfo.exists) {
    await FileSystem.writeAsStringAsync(LOG_FILE, '--- Log de Atividades do Haules PoS ---\n\n');
  }
};

type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';

/**
 * Registra uma mensagem no arquivo de log do aplicativo.
 * @param message A mensagem a ser registrada.
 * @param level O nível do log (ex: INFO, ERROR).
 */
export const log = async (message: string, level: LogLevel = 'INFO') => {
  await ensureLogFileExists();

  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level}] - ${message}\n`;

  try {
    // Lendo o conteúdo atual
    const currentContent = await FileSystem.readAsStringAsync(LOG_FILE);
    // Escrevendo o conteúdo novo concatenado ao antigo
    await FileSystem.writeAsStringAsync(LOG_FILE, currentContent + logEntry, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (error) {
    console.error('Falha ao escrever no arquivo de log:', error);
  }
};

/**
 * Lê e retorna todo o conteúdo do arquivo de log.
 * @returns O conteúdo do log como uma string.
 */
export const getLogContent = async (): Promise<string> => {
    await ensureLogFileExists();
    return await FileSystem.readAsStringAsync(LOG_FILE, {
        encoding: FileSystem.EncodingType.UTF8,
    });
};

/**
 * Limpa o arquivo de log.
 */
export const clearLog = async () => {
    await FileSystem.writeAsStringAsync(LOG_FILE, '--- Log de Atividades do Haules PoS (limpo) ---\n\n');
};
