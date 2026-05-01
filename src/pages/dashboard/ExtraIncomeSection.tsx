import { useEffect, useState, useCallback } from 'react'
import { useExtraIncomeStore } from '../../stores/extra-income.store'
import { useToast } from '../../components/ui/Toast'
import { Modal } from '../../components/ui/Modal'
import { ExtraIncomeList } from './ExtraIncomeList'
import { ExtraIncomeFormModal } from './ExtraIncomeFormModal'
import type { ExtraIncome } from '../../types'
import type { ExtraIncomeFormData } from '../../schemas/extra-income.schema'

interface ExtraIncomeSectionProps {
  profileId: string
  month: number
  year: number
}

export function ExtraIncomeSection({ profileId, month, year }: ExtraIncomeSectionProps) {
  const {
    extraIncomes,
    loading,
    fetchExtraIncomes,
    addExtraIncome,
    updateExtraIncome,
    removeExtraIncome,
  } = useExtraIncomeStore()
  const { showToast } = useToast()

  // Modal state
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingIncome, setEditingIncome] = useState<ExtraIncome | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingIncome, setDeletingIncome] = useState<ExtraIncome | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch extra incomes on mount and when month/year changes
  useEffect(() => {
    fetchExtraIncomes(profileId, month, year).catch(() => {
      showToast('Erro ao buscar ganhos extras', 'error')
    })
  }, [profileId, month, year, fetchExtraIncomes, showToast])

  // Open form modal for adding
  const handleAdd = useCallback(() => {
    setEditingIncome(null)
    setShowFormModal(true)
  }, [])

  // Open form modal for editing
  const handleEdit = useCallback((income: ExtraIncome) => {
    setEditingIncome(income)
    setShowFormModal(true)
  }, [])

  // Close form modal
  const handleCloseForm = useCallback(() => {
    setShowFormModal(false)
    setEditingIncome(null)
  }, [])

  // Handle form submit (create or update)
  const handleFormSubmit = useCallback(
    async (data: ExtraIncomeFormData) => {
      try {
        if (editingIncome) {
          await updateExtraIncome(editingIncome.id, data)
          showToast('Ganho extra atualizado!', 'success')
        } else {
          await addExtraIncome(profileId, data, month, year)
          showToast('Ganho extra adicionado!', 'success')
        }
        handleCloseForm()
      } catch {
        showToast(
          editingIncome
            ? 'Erro ao atualizar ganho extra'
            : 'Erro ao adicionar ganho extra',
          'error',
        )
      }
    },
    [editingIncome, profileId, month, year, addExtraIncome, updateExtraIncome, showToast, handleCloseForm],
  )

  // Open delete confirmation modal
  const handleDeleteRequest = useCallback((income: ExtraIncome) => {
    setDeletingIncome(income)
    setShowDeleteModal(true)
  }, [])

  // Close delete confirmation modal
  const handleCloseDelete = useCallback(() => {
    setShowDeleteModal(false)
    setDeletingIncome(null)
  }, [])

  // Confirm deletion
  const handleConfirmDelete = useCallback(async () => {
    if (!deletingIncome) return
    setDeleting(true)
    try {
      await removeExtraIncome(deletingIncome.id)
      showToast('Ganho extra excluído!', 'success')
      handleCloseDelete()
    } catch {
      showToast('Erro ao excluir ganho extra', 'error')
    } finally {
      setDeleting(false)
    }
  }, [deletingIncome, removeExtraIncome, showToast, handleCloseDelete])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#64748b', margin: 0 }}>
          Ganhos Extras
        </h2>
        <button
          type="button"
          onClick={handleAdd}
          aria-label="Adicionar ganho extra"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#2563eb',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>
          Carregando...
        </p>
      ) : (
        <ExtraIncomeList
          incomes={extraIncomes}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
        />
      )}

      {/* Form modal (create / edit) */}
      <ExtraIncomeFormModal
        isOpen={showFormModal}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        initialData={editingIncome}
      />

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={handleCloseDelete}
        title="Excluir Ganho Extra"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 14, color: '#334155', margin: 0 }}>
            Tem certeza que deseja excluir este ganho extra?
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handleCloseDelete}
              style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: 14,
                border: '1.5px solid #e2e8f0',
                background: '#fff',
                color: '#64748b',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: 14,
                border: 'none',
                background: '#ef4444',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
