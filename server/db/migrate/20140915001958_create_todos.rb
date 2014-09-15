class CreateTodos < ActiveRecord::Migration
  def change
    create_table :todos, id: :uuid do |t|
      t.string :title
      t.text :description
      t.uuid :user_id

      t.timestamps
    end
  end
end
