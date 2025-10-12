import nltk
import os

# Define o diretório de dados do NLTK para ser dentro do diretório do projeto
NLTK_DATA_DIR = os.path.join(os.path.dirname(__file__), 'nltk_data')
os.makedirs(NLTK_DATA_DIR, exist_ok=True)
nltk.data.path.append(NLTK_DATA_DIR)

# Descarrega os pacotes necessários
nltk.download('stopwords', download_dir=NLTK_DATA_DIR)
nltk.download('punkt', download_dir=NLTK_DATA_DIR)
