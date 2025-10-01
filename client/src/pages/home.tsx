import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProcessSearchForm from "@/components/process-search-form";
import AdvancedSearchForm from "@/components/advanced-search-form";
import BulkSearchForm from "@/components/bulk-search-form";
import ProcessResults from "@/components/process-results";
import AdvancedSearchResults from "@/components/advanced-search-results";
import BulkSearchResults from "@/components/bulk-search-results";
import SearchHistory from "@/components/search-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ProcessResult, type BulkSearchResult } from "@shared/schema";
import { type ApiResponse } from "@/lib/types";

export default function Home() {
  const [activeSection, setActiveSection] = useState<"buscar" | "historico" | "favoritos" | "ajuda">("buscar");
  const [searchResult, setSearchResult] = useState<ProcessResult | null>(null);
  const [advancedSearchResults, setAdvancedSearchResults] = useState<ProcessResult[]>([]);
  const [bulkSearchResults, setBulkSearchResults] = useState<BulkSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: searchHistory, refetch: refetchHistory } = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/search-history"],
  });

  const { data: favorites, refetch: refetchFavorites } = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/favorites"],
  });

  const handleSearchSuccess = (result: ProcessResult) => {
    setSearchResult(result);
    setAdvancedSearchResults([]);
    setBulkSearchResults([]);
    refetchHistory();
  };

  const handleAdvancedSearchSuccess = (results: ProcessResult[]) => {
    setAdvancedSearchResults(results);
    setSearchResult(null);
    setBulkSearchResults([]);
    refetchHistory();
  };

  const handleBulkSearchSuccess = (results: BulkSearchResult[]) => {
    setBulkSearchResults(results);
    setSearchResult(null);
    setAdvancedSearchResults([]);
    refetchHistory();
  };

  const handleProcessSelect = (result: ProcessResult) => {
    setSearchResult(result);
    setAdvancedSearchResults([]);
    setBulkSearchResults([]);
  };

  const handleBulkProcessSelect = (bulkResult: BulkSearchResult) => {
    if (bulkResult.result) {
      setSearchResult(bulkResult.result);
      setAdvancedSearchResults([]);
      setBulkSearchResults([]);
    }
  };

  const handleFavoriteToggle = () => {
    refetchFavorites();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <i className="fas fa-gavel text-primary text-2xl"></i>
                <h1 className="text-2xl font-bold text-primary">Processo Fácil</h1>
              </div>
              <span className="hidden sm:inline text-sm text-muted-foreground">Consulta DataJud CNJ</span>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <button 
                onClick={() => setActiveSection("buscar")}
                className={`${activeSection === "buscar" ? "text-foreground font-medium" : "text-muted-foreground"} hover:text-primary transition-colors`}
                data-testid="nav-buscar"
              >
                Buscar
              </button>
              <button 
                onClick={() => setActiveSection("historico")}
                className={`${activeSection === "historico" ? "text-foreground font-medium" : "text-muted-foreground"} hover:text-primary transition-colors`}
                data-testid="nav-historico"
              >
                Histórico
              </button>
              <button 
                onClick={() => setActiveSection("favoritos")}
                className={`${activeSection === "favoritos" ? "text-foreground font-medium" : "text-muted-foreground"} hover:text-primary transition-colors`}
                data-testid="nav-favoritos"
              >
                Favoritos
              </button>
              <button 
                onClick={() => setActiveSection("ajuda")}
                className={`${activeSection === "ajuda" ? "text-foreground font-medium" : "text-muted-foreground"} hover:text-primary transition-colors`}
                data-testid="nav-ajuda"
              >
                Ajuda
              </button>
            </nav>
            <button className="md:hidden">
              <i className="fas fa-bars text-foreground"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Main Content Area */}
          <div className="flex-1">
            {activeSection === "buscar" && (
              <>
                <ProcessSearchForm 
                  onSearchSuccess={handleSearchSuccess}
                  isSearching={isSearching}
                  setIsSearching={setIsSearching}
                />

                <AdvancedSearchForm 
                  onSearchSuccess={handleAdvancedSearchSuccess}
                  isSearching={isSearching}
                  setIsSearching={setIsSearching}
                />

                <BulkSearchForm 
                  onSearchSuccess={handleBulkSearchSuccess}
                  isSearching={isSearching}
                  setIsSearching={setIsSearching}
                />

                {bulkSearchResults.length > 0 && (
                  <BulkSearchResults 
                    results={bulkSearchResults}
                    onProcessSelect={handleBulkProcessSelect}
                  />
                )}

                {advancedSearchResults.length > 0 && (
                  <AdvancedSearchResults 
                    results={advancedSearchResults}
                    onProcessSelect={handleProcessSelect}
                  />
                )}

                {searchResult && (
                  <ProcessResults 
                    result={searchResult} 
                    onFavoriteToggle={handleFavoriteToggle}
                    favorites={favorites?.data || []}
                  />
                )}
              </>
            )}

            {activeSection === "historico" && (
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Consultas</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Veja todas as suas consultas anteriores
                  </p>
                </CardHeader>
                <CardContent>
                  <SearchHistory 
                    history={searchHistory?.data || []} 
                    onProcessSelect={handleProcessSelect}
                  />
                </CardContent>
              </Card>
            )}

            {activeSection === "favoritos" && (
              <Card>
                <CardHeader>
                  <CardTitle>Processos Favoritos</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Processos que você marcou como favoritos
                  </p>
                </CardHeader>
                <CardContent>
                  {favorites?.data && favorites.data.length > 0 ? (
                    <div className="space-y-3">
                      {favorites.data
                        .filter((fav: any) => fav.processData)
                        .map((fav: any) => (
                        <div 
                          key={fav.id} 
                          className="p-4 border border-border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleProcessSelect(fav.processData)}
                          data-testid={`favorite-${fav.processNumber}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {fav.processNumber}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {fav.tribunal} - {fav.processData.classeProcessual || "N/A"}
                              </p>
                            </div>
                            <i className="fas fa-heart text-red-500"></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum processo favoritado ainda.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "ajuda" && (
              <Card>
                <CardHeader>
                  <CardTitle>Central de Ajuda</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Encontre respostas para suas dúvidas
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Como buscar um processo?</h3>
                    <p className="text-sm text-muted-foreground">
                      Digite o número do processo no formato CNJ (ex: 0000000-00.0000.0.00.0000) e selecione o tribunal correspondente para realizar a consulta.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">O que é busca avançada?</h3>
                    <p className="text-sm text-muted-foreground">
                      A busca avançada permite filtrar processos por classe processual, órgão julgador, 
                      período de ajuizamento e termos específicos.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Como funciona a busca em lote?</h3>
                    <p className="text-sm text-muted-foreground">
                      Insira múltiplos números de processo (um por linha, máximo 1000) ou importe um arquivo CSV para buscar vários processos simultaneamente.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Posso exportar os dados?</h3>
                    <p className="text-sm text-muted-foreground">
                      Sim! Clique no botão de exportar nos resultados para baixar em PDF, Excel, CSV ou JSON.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">De onde vêm os dados?</h3>
                    <p className="text-sm text-muted-foreground">
                      Todos os dados são obtidos da API Pública do DataJud - CNJ, que consolida informações 
                      processuais de todos os tribunais do Brasil.
                      <a 
                        href="https://datajud-wiki.cnj.jus.br/api-publica/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline ml-1"
                      >
                        Saiba mais
                      </a>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          {activeSection === "buscar" && (
            <div className="hidden lg:block w-80">
              <SearchHistory 
                history={searchHistory?.data || []} 
                onProcessSelect={handleProcessSelect}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h5 className="font-semibold text-foreground mb-3">Processo Fácil</h5>
              <p className="text-sm text-muted-foreground">
                Plataforma de consulta aos dados públicos do DataJud - CNJ.
                Acesso simplificado às informações processuais de todo o Brasil.
              </p>
            </div>
            <div>
              <h5 className="font-semibold text-foreground mb-3">Recursos</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button onClick={() => setActiveSection("buscar")} className="hover:text-primary transition-colors">
                    Busca de Processos
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveSection("historico")} className="hover:text-primary transition-colors">
                    Histórico de Consultas
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveSection("ajuda")} className="hover:text-primary transition-colors">
                    Central de Ajuda
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-foreground mb-3">Suporte</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button onClick={() => setActiveSection("ajuda")} className="hover:text-primary transition-colors">
                    Central de Ajuda
                  </button>
                </li>
                <li>
                  <a href="https://datajud-wiki.cnj.jus.br/api-publica/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                    Documentação DataJud
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © 2024 Processo Fácil. Dados fornecidos pela API Pública do DataJud - CNJ.
              <a href="https://datajud-wiki.cnj.jus.br/api-publica/" className="text-primary hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                Documentação oficial
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
