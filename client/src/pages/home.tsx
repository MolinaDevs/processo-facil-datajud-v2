import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProcessSearchForm from "@/components/process-search-form";
import AdvancedSearchForm from "@/components/advanced-search-form";
import ProcessResults from "@/components/process-results";
import AdvancedSearchResults from "@/components/advanced-search-results";
import SearchHistory from "@/components/search-history";
import { type ProcessResult } from "@shared/schema";
import { type ApiResponse } from "@/lib/types";

export default function Home() {
  const [searchResult, setSearchResult] = useState<ProcessResult | null>(null);
  const [advancedSearchResults, setAdvancedSearchResults] = useState<ProcessResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: searchHistory, refetch: refetchHistory } = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/search-history"],
  });

  const { data: favorites, refetch: refetchFavorites } = useQuery<ApiResponse<any[]>>({
    queryKey: ["/api/favorites"],
  });

  const handleSearchSuccess = (result: ProcessResult) => {
    setSearchResult(result);
    setAdvancedSearchResults([]); // Clear advanced results
    refetchHistory();
  };

  const handleAdvancedSearchSuccess = (results: ProcessResult[]) => {
    setAdvancedSearchResults(results);
    setSearchResult(null); // Clear single result
    refetchHistory();
  };

  const handleProcessSelect = (result: ProcessResult) => {
    setSearchResult(result);
    setAdvancedSearchResults([]); // Clear advanced results when selecting from list
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
              <a href="#" className="text-foreground hover:text-primary transition-colors">Buscar</a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">Histórico</a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">Favoritos</a>
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">Ajuda</a>
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
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-80">
            <SearchHistory 
              history={searchHistory?.data || []} 
              onProcessSelect={handleProcessSelect}
            />
          </div>
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
                <li><a href="#" className="hover:text-primary transition-colors">Busca de Processos</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Histórico de Consultas</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Alertas Automáticos</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">API Documentation</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-foreground mb-3">Suporte</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Política de Privacidade</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contato</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              © 2024 Processo Fácil. Dados fornecidos pela API Pública do DataJud - CNJ.
              <a href="https://datajud-wiki.cnj.jus.br/api-publica/" className="text-primary hover:underline ml-1">
                Documentação oficial
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
