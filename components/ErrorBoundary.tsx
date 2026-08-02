import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Sans ce garde-fou, la moindre erreur de rendu démonte tout l'arbre React et
 * laisse une page blanche : l'utilisateur croit avoir perdu sa fiche alors que
 * les données sont toujours en localStorage.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erreur de rendu interceptée :', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Une erreur est survenue</h1>
          <p className="text-slate-600 text-sm mb-4">
            L'affichage a été interrompu, mais <strong>vos fiches sont intactes</strong> : elles sont
            enregistrées localement dans le navigateur. Rechargez la page pour reprendre.
          </p>
          <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto text-rose-700 mb-5">
            {error.message}
          </pre>
          <button
            onClick={this.handleReload}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition shadow-sm"
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
