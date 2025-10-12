# Adicione estes imports no topo do seu app.py
import os
import uuid
from flask import Flask, render_template, request, jsonify, url_for
from werkzeug.utils import secure_filename
import serpapi # Apenas importe a biblioteca principal
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

# Configuração da Aplicação
app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
app.config['UPLOAD_FOLDER'] = os.path.join(app.static_folder, 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Descarrega as stopwords para o português (se ainda não tiver)
try:
    stop_words = set(stopwords.words('portuguese'))
except LookupError:
    nltk.download('stopwords')
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
    # --- 1. RECEBER E GUARDAR A IMAGEM TEMPORARIAMENTE ---
    if 'imagem_referencia' not in request.files:
        return jsonify({"status": "erro", "mensagem": "Nenhum ficheiro de imagem enviado."}), 400
    
    file = request.files['imagem_referencia']
    
    if file.filename == '':
        return jsonify({"status": "erro", "mensagem": "Nenhum ficheiro selecionado."}), 400

    filename = secure_filename(f"{uuid.uuid4()}_{file.filename}")
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    print(f"--- Imagem temporária guardada em: {filepath} ---")

    # --- A CORREÇÃO CRUCIAL ESTÁ AQUI ---
    # No Render, a aplicação já tem um URL público. Não precisamos do ngrok.
    # A imagem será acessível diretamente através do URL do Render.
    # Por exemplo: https://assistente-estilo-ia.onrender.com/frontend/uploads/{filename}
    # O frontend já deve estar a construir o URL corretamente.
    # Se o frontend precisar do URL base, ele pode ser passado via render_template ou uma variável JS.
    # Por enquanto, vamos assumir que o frontend sabe como acessar /frontend/uploads/{filename}
    
    # Para o Render, o URL da imagem será relativo ao servidor
    image_public_url = f"/frontend/uploads/{filename}"
    print(f"--- URL pública REAL da imagem gerada: {image_public_url} ---")

    # --- 3. CHAMAR A API DO GOOGLE LENS COM A URL ---
    try:
        print(f"--- A enviar URL para a API Google Lens da SerpApi... ---")
        params = {
            "engine": "google_lens",
            "url": image_public_url, # Usamos o URL relativo ao servidor Render
            "api_key": SERPAPI_API_KEY
        }
        client = serpapi.Client()
        results = client.search(params)
        
        # Extrai apenas os resultados que nos interessam
        visual_matches = results.get("visual_matches", [])
        
        print(f"--- Resposta da API recebida! Encontrados {len(visual_matches)} resultados. ---")
        return jsonify({"status": "sucesso", "results": visual_matches})

    except Exception as e:
        print(f"ERRO AO CHAMAR A API: {e}")
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
    
    finally:
        # --- 4. LIMPAR: APAGAR A IMAGEM TEMPORÁRIA ---
        # Este bloco 'finally' garante que a imagem é apagada mesmo que ocorra um erro
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
    tokens = word_tokenize(texto_limpo)
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
