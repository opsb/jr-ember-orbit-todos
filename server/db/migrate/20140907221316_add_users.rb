class AddUsers < ActiveRecord::Migration
  def change
	  create_table "users", id: :uuid, force: true do |t|
	    t.string   "email",                  default: "", null: false
	    t.string   "encrypted_password",     default: "", null: false
	    t.string   "reset_password_token"
	    t.datetime "reset_password_sent_at"
	    t.datetime "remember_created_at"
	    t.integer  "sign_in_count",          default: 0,  null: false
	    t.datetime "current_sign_in_at"
	    t.datetime "last_sign_in_at"
	    t.string   "current_sign_in_ip"
	    t.string   "last_sign_in_ip"
	    t.datetime "created_at"
	    t.datetime "updated_at"
	    t.string   "access_token"
	    t.string   "first_name"
	    t.string   "last_name"
	    t.string   "invitation_code"
	    t.integer  "invitor_id"
	  end

	  add_index "users", ["email"], name: "index_users_on_email", unique: true, using: :btree
	  add_index "users", ["invitor_id"], name: "index_users_on_invitor_id", using: :btree
	  add_index "users", ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true, using: :btree
  end
end
