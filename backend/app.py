# Adicione estes imports no topo do seu app.py
import os
import uuid
from flask import Flask, render_template, request, jsonify, url_for
from werkzeug.utils import secure_filename
import serpapi # Apenas importe a biblioteca principal
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import requests # Adicionado para a lógica de aquecimento

# Define o diretório de dados do NLTK para ser dentro do diretório do projeto
NLTK_DATA_DIR = os.path.join(os.path.dirname(__file__), 'nltk_data')
os.makedirs(NLTK_DATA_DIR, exist_ok=True)
nltk.data.path.append(NLTK_DATA_DIR)

# Configuração da Aplicação
app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
app.config['UPLOAD_FOLDER'] = os.path.join(app.static_folder, 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Descarrega as stopwords para o português (se ainda não tiver)
# Em produção, o download deve ser feito durante a fase de build do Render.
# A linha `nltk.download('stopwords')` foi removida para evitar erros em tempo de execução.
stop_words = set(stopwords.words('portuguese'))

# --- CONFIGURAÇÃO DAS CHAVES DE API ---
# --- CONFIGURAÇÃO DA CHAVE DE API (MODO DE PRODUÇÃO) ---
# Lê a chave da variável de ambiente configurada no servidor do Render
SERPAPI_API_KEY = os.environ.get('SERPAPI_API_KEY', '')
# ------------------------------------

# --- ROTAS DA APLICAÇÃO ---
@app.route("/")
def pagina_inicial():
    return app.send_static_file('index.html')

@app.route("/api/search-image", methods=['POST'])
def search_image():
    if 'imagem_referencia' not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum ficheiro de imagem enviado."}), 400
    
    file = request.files['imagem_referencia']
    if file.filename == '':
        return jsonify({"status": "erro", "mensagem": "Nenhum ficheiro selecionado."}), 400

    filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    print(f"--- Imagem temporária guardada em: {filepath} ---")

    # Obtém a URL base da aplicação a partir do pedido atual
    base_url = request.host_url
    image_public_url = f"{base_url}frontend/uploads/{filename}"
    print(f"--- URL pública da imagem gerada: {image_public_url} ---")

    try:
        # --- LÓGICA DE AQUECIMENTO ---
        # Antes de enviar para a SerpApi, fazemos um pedido a nós mesmos para "acordar" o servidor de ficheiros.
        print("--- A 'aquecer' o servidor de ficheiros... ---")
        warmup_response = requests.get(image_public_url, timeout=60) # Aumentado o timeout para 60 segundos
        warmup_response.raise_for_status() # Lança um erro se não conseguir aceder à imagem
        print(f"--- Servidor 'aquecido' com sucesso (Status: {warmup_response.status_code}) ---")
        # ----------------------------

        print(f"--- A enviar URL para a API Google Lens da SerpApi... ---")
        params = {
            "engine": "google_lens",
            "url": image_public_url,
            "api_key": SERPAPI_API_KEY
        }
        client = serpapi.Client()
        results = client.search(params)
        
        visual_matches = results.get("visual_matches", [])
        
        print(f"--- Resposta da API recebida! Encontrados {len(visual_matches)} resultados. ---")
        return jsonify({"status": "sucesso", "results": visual_matches})

    except requests.exceptions.RequestException as e:
        # Este erro agora pode apanhar o erro de aquecimento ou o erro da SerpApi
        print(f"ERRO DE REDE (Aquecimento ou SerpApi): {e}")
        return jsonify({"status": "erro", "mensagem": f"Erro de rede ao processar o pedido: {e}"}), 500
    except Exception as e:
        print(f"ERRO GERAL AO CHAMAR A API: {e}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
    
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)
            print(f"--- Imagem temporária removida: {filepath} ---")

@app.route("/api/search-text", methods=['POST'])
def search_text():
    dados = request.get_json()
    produto = dados.get('produto', '')
    # Biotipo e tamanho não são mais usados diretamente na query, mas o frontend ainda pode enviá-los
    # biotipo = dados.get('biotipo', '')
    # tamanho = dados.get('tamanho', '')

    # --- PIPELINE DE PLN (continua igual) ---
    texto_limpo = produto.lower()
    tokens = word_tokenize(texto_limpo, language='portuguese')
    palavras_chave = [word for word in tokens if word.isalpha() and word not in stop_words]
    prompt_final = " ".join(palavras_chave)
    
    # --- LÓGICA DE QUERY FINAL E REFINADA ---
    # 1. Adiciona contexto de "estilo" e "inspiração"
    # 2. Usa o prompt limpo do utilizador
    # 3. Remove a restrição de 'site:' para obter resultados de todo o lado (blogs, instagram, etc.)
    final_query = f"look inspiração outfit {prompt_final}"
    
    print(f"--- Query de busca de IMAGENS REFINADA: {final_query} ---")

    try:
        params = {
            "engine": "google_images", # <-- MUDANÇA CRUCIAL: Usamos o motor de imagens
            "q": final_query,
            "api_key": SERPAPI_API_KEY
        }
        client = serpapi.Client()
        results = client.search(params)

        image_results = results.get("images_results", [])
        
        normalized_results = []
        for item in image_results:
            if item.get("thumbnail") and item.get("link"):
                normalized_results.append({
                    "link": item.get("original_link", item.get("link")), # Prefere o link original
                    "thumbnail": item.get("thumbnail"),
                    "title": item.get("title"),
                    "source": item.get("source")
                })

        print(f"--- Busca de imagens encontrou {len(normalized_results)} resultados. ---")
        return jsonify({"status": "sucesso", "results": normalized_results})

    except Exception as e:
        print(f"ERRO AO CHAMAR A API DE BUSCA DE IMAGENS: {e}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
