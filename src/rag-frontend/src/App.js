// src/App.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';
const DEFAULT_PROJECT_ID = 'project1'; // You can make this configurable

function App() {
  const [file, setFile] = useState(null);
  const [fileId, setFileId] = useState(null);
  const [isProcessed, setIsProcessed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [isLoading, setIsLoading] = useState({
    upload: false,
    process: false,
    search: false,
    answer: false
  });
  const [error, setError] = useState(null);

  const handleFileSelect = (e) => {
    setFile(e.target.files[0]);
    setFileId(null);
    setIsProcessed(false);
  };

  const handleFileUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setIsLoading({ ...isLoading, upload: true });
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/data/upload/${DEFAULT_PROJECT_ID}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.signal === 'file_upload_success') {
        setFileId(response.data.file_id);
      }
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setIsLoading({ ...isLoading, upload: false });
    }
  };

  const handleProcess = async () => {
    if (!fileId) return;

    setIsLoading({ ...isLoading, process: true });
    setError(null);

    try {
      // Process the uploaded file
      const processResponse = await axios.post(
        `${API_BASE_URL}/data/process/${DEFAULT_PROJECT_ID}`,
        {
          // file_id: fileId,
          chunk_size: 400,
          overlap_size: 50,
          do_reset: 1
        }
      );

      if (processResponse.data.signal === 'processing_success') {
        // Push to vector index
        const pushResponse = await axios.post(
          `${API_BASE_URL}/nlp/index/push/${DEFAULT_PROJECT_ID}`,
          {
            do_reset: true
          }
        );

        if (pushResponse.data.signal === 'insert_into_vectordb_success') {
          setIsProcessed(true);
        }
      }
    } catch (err) {
      setError('Processing failed: ' + err.message);
    } finally {
      setIsLoading({ ...isLoading, process: false });
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsLoading({ ...isLoading, search: true });
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/nlp/index/search/${DEFAULT_PROJECT_ID}`,
        {
          text: searchQuery,
          limit: 5
        }
      );

      if (response.data.signal === 'vectordb_search_success') {
        setSearchResults(response.data.results);
      }
    } catch (err) {
      setError('Search failed: ' + err.message);
    } finally {
      setIsLoading({ ...isLoading, search: false });
    }
  };

  const handleGetAnswer = async () => {
    setIsLoading({ ...isLoading, answer: true });
    setError(null);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/nlp/index/answer/${DEFAULT_PROJECT_ID}`,
        {
          text: searchQuery,
          limit: 4
        }
      );

      if (response.data.signal === 'rag_answer_success') {
        setAnswer(response.data.answer);
      }
    } catch (err) {
      setError('Failed to get answer: ' + err.message);
    } finally {
      setIsLoading({ ...isLoading, answer: false });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h1 className="text-2xl font-bold mb-8">RAG Document System</h1>

                {/* File Upload Section */}
                {!isProcessed && (
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700">
                      Upload Document
                    </label>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      className="mt-1 block w-full text-sm text-gray-500
                               file:mr-4 file:py-2 file:px-4
                               file:rounded-full file:border-0
                               file:text-sm file:font-semibold
                               file:bg-blue-50 file:text-blue-700
                               hover:file:bg-blue-100"
                    />
                    {file && !fileId && (
                      <button
                        onClick={handleFileUpload}
                        disabled={isLoading.upload}
                        className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {isLoading.upload ? 'Uploading...' : 'Upload'}
                      </button>
                    )}
                  </div>
                )}

                {/* Process Section */}
                {fileId && !isProcessed && (
                  <div className="mb-8">
                    <button
                      onClick={handleProcess}
                      disabled={isLoading.process}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      {isLoading.process ? 'Processing...' : 'Process Document'}
                    </button>
                  </div>
                )}

                {/* Search Section */}
                {isProcessed && (
                  <div className="mt-8">
                    <form onSubmit={handleSearch}>
                      <div className="mt-1 flex rounded-md shadow-sm">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="Enter your query..."
                        />
                        <button
                          type="submit"
                          disabled={isLoading.search}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {isLoading.search ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                    </form>

                    <button
                      onClick={handleGetAnswer}
                      disabled={isLoading.answer || !searchQuery}
                      className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      {isLoading.answer ? 'Getting Answer...' : 'Get AI Answer'}
                    </button>
                  </div>
                )}

                {error && (
                  <div className="mt-4 text-red-600 text-sm">{error}</div>
                )}

                {/* Results Section */}
                {searchResults.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold mb-4">Search Results</h2>
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        className="mb-6 p-4 border rounded-lg bg-gray-50"
                      >
                        <p className="text-sm text-gray-600">{result.text}</p>
                        <div className="mt-2 text-xs text-gray-500">
                          Score: {result.score}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Answer Section */}
                {answer && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold mb-4">AI Answer</h2>
                    <div className="p-4 border rounded-lg bg-purple-50">
                      <p className="text-gray-700">{answer}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;