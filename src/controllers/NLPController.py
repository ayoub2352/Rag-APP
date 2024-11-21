from .BaseController import BaseController
from models.db_schemes import Project, DataChunk
from stores.llm.LLMEnums import DocumentTypeEnum
from typing import List, Tuple, Dict, Optional
import json
import logging
from math import ceil

class NLPController(BaseController):
    def __init__(self, vectordb_client, generation_client, embedding_client, template_parser):
        super().__init__()
        self.vectordb_client = vectordb_client
        self.generation_client = generation_client
        self.embedding_client = embedding_client
        self.template_parser = template_parser
        self.BATCH_SIZE = 50  # Configurable batch size
        self._setup_logging()

    def _setup_logging(self):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def create_collection_name(self, project_id: str):
        return f"collection_{project_id}".strip()
    
    def reset_vector_db_collection(self, project: Project):
        collection_name = self.create_collection_name(project_id=project.project_id)
        return self.vectordb_client.delete_collection(collection_name=collection_name)
    
    def get_vector_db_collection_info(self, project: Project):
        collection_name = self.create_collection_name(project_id=project.project_id)
        collection_info = self.vectordb_client.get_collection_info(collection_name=collection_name)
        return json.loads(json.dumps(collection_info, default=lambda x: x.__dict__))

    def _process_batch(self, texts: List[str], metadata: List[Dict], 
                      chunks_ids: List[int]) -> Tuple[List[List[float]], List[str], List[Dict], List[int]]:
        """Process a batch of texts and return their embeddings"""
        processed_vectors = []
        failed_indices = []
        
        for idx, text in enumerate(texts):
            try:
                vector = self.embedding_client.embed_text(
                    text=text,
                    document_type=DocumentTypeEnum.DOCUMENT.value
                )
                if vector and len(vector) > 0:
                    processed_vectors.append(vector)
                else:
                    failed_indices.append(idx)
                    self.logger.warning(f"Failed to generate embedding for chunk {chunks_ids[idx]}")
            except Exception as e:
                failed_indices.append(idx)
                self.logger.error(f"Error processing chunk {chunks_ids[idx]}: {str(e)}")

        # Remove failed items from all lists
        for idx in reversed(failed_indices):
            texts.pop(idx)
            metadata.pop(idx)
            chunks_ids.pop(idx)

        return processed_vectors, texts, metadata, chunks_ids

    def index_into_vector_db(self, project: Project, chunks: List[DataChunk],
                           chunks_ids: List[int], do_reset: bool = False) -> bool:
        try:
            # Step 1: Get collection name
            collection_name = self.create_collection_name(project_id=project.project_id)
            
            # Step 2: Create or reset collection
            _ = self.vectordb_client.create_collection(
                collection_name=collection_name,
                embedding_size=self.embedding_client.embedding_size,
                do_reset=do_reset,
            )

            # Step 3: Prepare initial data
            texts = [c.chunk_text for c in chunks]
            metadata = [c.chunk_metadata for c in chunks]

            # Step 4: Process in batches
            total_chunks = len(chunks)
            num_batches = ceil(total_chunks / self.BATCH_SIZE)
            
            self.logger.info(f"Processing {total_chunks} chunks in {num_batches} batches")
            
            for batch_num in range(num_batches):
                start_idx = batch_num * self.BATCH_SIZE
                end_idx = min((batch_num + 1) * self.BATCH_SIZE, total_chunks)
                
                batch_texts = texts[start_idx:end_idx]
                batch_metadata = metadata[start_idx:end_idx]
                batch_chunks_ids = chunks_ids[start_idx:end_idx]

                self.logger.info(f"Processing batch {batch_num + 1}/{num_batches} with {len(batch_texts)} items")

                # Process the batch
                vectors, processed_texts, processed_metadata, processed_chunks_ids = self._process_batch(
                    batch_texts, batch_metadata, batch_chunks_ids
                )

                if vectors and len(vectors) > 0:
                    # Insert processed batch into vector db
                    insertion_result = self.vectordb_client.insert_many(
                        collection_name=collection_name,
                        texts=processed_texts,
                        metadata=processed_metadata,
                        vectors=vectors,
                        record_ids=processed_chunks_ids,
                    )
                    
                    if not insertion_result:
                        self.logger.error(f"Failed to insert batch {batch_num + 1}")
                        return False
                    
                    self.logger.info(f"Successfully inserted batch {batch_num + 1} with {len(vectors)} vectors")

            return True

        except Exception as e:
            self.logger.error(f"Error in index_into_vector_db: {str(e)}")
            return False

    def search_vector_db_collection(self, project: Project, text: str, limit: int = 10):
        try:
            # Step 1: get collection name
            collection_name = self.create_collection_name(project_id=project.project_id)

            # Step 2: get text embedding vector
            vector = self.embedding_client.embed_text(
                text=text, 
                document_type=DocumentTypeEnum.QUERY.value
            )

            if not vector or len(vector) == 0:
                return False

            # Step 3: do semantic search
            results = self.vectordb_client.search_by_vector(
                collection_name=collection_name,
                vector=vector,
                limit=limit
            )

            return results if results else False

        except Exception as e:
            self.logger.error(f"Error in search_vector_db_collection: {str(e)}")
            return False
    
    def answer_rag_question(self, project: Project, query: str, limit: int = 10):
        try:
            answer, full_prompt, chat_history = None, None, None

            # Step 1: retrieve related documents
            retrieved_documents = self.search_vector_db_collection(
                project=project,
                text=query,
                limit=limit,
            )

            if not retrieved_documents or len(retrieved_documents) == 0:
                return answer, full_prompt, chat_history
            
            # Step 2: Construct LLM prompt
            system_prompt = self.template_parser.get("rag", "system_prompt")

            documents_prompts = "\n".join([
                self.template_parser.get("rag", "document_prompt", {
                        "doc_num": idx + 1,
                        "chunk_text": doc.text,
                })
                for idx, doc in enumerate(retrieved_documents)
            ])

            footer_prompt = self.template_parser.get("rag", "footer_prompt", {
                "query": query
            })

            # Step 3: Construct Generation Client Prompts
            chat_history = [
                self.generation_client.construct_prompt(
                    prompt=system_prompt,
                    role=self.generation_client.enums.SYSTEM.value,
                )
            ]

            full_prompt = "\n\n".join([documents_prompts, footer_prompt])

            # Step 4: Retrieve the Answer
            answer = self.generation_client.generate_text(
                prompt=full_prompt,
                chat_history=chat_history
            )

            return answer, full_prompt, chat_history

        except Exception as e:
            self.logger.error(f"Error in answer_rag_question: {str(e)}")
            return None, None, None